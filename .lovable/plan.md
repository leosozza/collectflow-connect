## Correções

### Bug 1 — Aging ignora parcelas `vencido`
**Arquivo:** `supabase/functions/portal-lookup/index.ts` (action `get-templates`)

Trocar:
```ts
.eq("status", "pendente")
```
por:
```ts
.in("status", ["pendente", "vencido"])
```

Motivo: hoje 91% da base aberta está como `vencido` (153k vs 15k `pendente`). Com o filtro atual, dívidas antigas vencidas são ignoradas e o portal escolhe a faixa errada (ex.: CPF com parcela de Jan/2026 vencida cai em "0–30" em vez de "91–180").

### Bug 2 — Auto-aprovação de acordos do Portal vindos de Template
**Arquivos:**
- `supabase/functions/portal-lookup/index.ts` (action `create-portal-agreement`)
- Nova action auxiliar ou chamada direta ao mesmo fluxo do operador

**Regra:** se o acordo veio de um `template_id` válido (oferta pré-aprovada pelo credor), criar já com `status='active'` e disparar a geração de parcelas + boletos (mesmo caminho usado em `agreementService.createAgreement`/`finalizeAgreement`). Se for "Fazer minha proposta" (sem `template_id`), mantém `status='pending'` para revisão manual (comportamento atual).

**Implementação:**
1. No edge function, ao receber `template_id`:
   - Validar que o template existe, está ativo e pertence ao credor/tenant
   - Validar que `proposed_total`/`new_installments` batem com o template (anti-tampering)
   - Inserir `agreement` com `status='active'`, `portal_origin=true`
   - Chamar RPC existente (ou replicar lógica) que gera `agreement_installments` + invoca geração Negociarie/boleto via `negociarie-create-cobranca` para a entrada/parcelas conforme `credor.gateway_pagamento`
2. Atualizar `PortalNegotiation.tsx` para, no sucesso de template, mostrar tela "Acordo confirmado — boleto da entrada será enviado em instantes para seu e-mail/WhatsApp" + link direto se já houver `checkout_token`/`boleto_url`
3. Custom proposal: tela "Aguardando aprovação — entraremos em contato em até 24h"

### Cleanup
Remover os 3 templates `TESTE *` criados no credor TESS durante testes (via migração `DELETE WHERE name ILIKE 'TESTE %'` ou direto via SQL admin).

## Garantias de não-regressão
- Fluxo operador (`AgreementForm`) intacto — nenhuma mudança em `agreementService`
- Templates sem `aging_min/max` continuam aparecendo para todos
- Custom proposal continua `pending` (admin revisa)
- Validação anti-tampering no edge impede cliente injetar valores fora do template

## Explicação da faixa de aging (para a resposta após implementação)

**Aging** = quantos dias estão em atraso desde o vencimento mais antigo em aberto do CPF naquele credor.

**Fórmula:** `floor((hoje − MIN(data_vencimento das parcelas em aberto)) / 1 dia)`

**Como funciona no Portal:**
1. Devedor digita CPF → edge `portal-lookup` calcula o aging dele
2. RPC filtra os modelos do credor: só mostra os que têm `aging_min ≤ aging_devedor ≤ aging_max`
3. Modelos sem faixa (`NULL/NULL`) aparecem sempre

**Estratégia comercial sugerida:**
- `0–30 dias`: desconto pequeno (5–15%) + parcelado longo — devedor ainda "fresco", menos urgência de fechar
- `31–90 dias`: desconto médio (20–40%) — começa a apertar
- `91–180 dias`: desconto alto (40–60%) — risco de prescrição aumentando
- `181–360 dias`: desconto muito alto (60–80%) à vista — recuperar é melhor que perder
- `360+ dias`: melhor oferta possível (80–95%) — quase prescrito, qualquer recuperação vale

O credor cadastra **N modelos** com faixas diferentes; o devedor vê **só os que se aplicam à idade da dívida dele**, evitando que ofereça desconto absurdo a quem acabou de atrasar.

## Arquivos tocados
1. `supabase/functions/portal-lookup/index.ts` — fix aging query + auto-approve em template + chamada de geração de boleto
2. `src/components/portal/PortalNegotiation.tsx` — UX pós-confirmação diferenciada (template vs custom)
3. Migração SQL — cleanup dos templates `TESTE *`
