## Objetivo

Permitir que o credor defina **faixas de dias em atraso** (aging) em cada Modelo de Acordo do Portal, para que o devedor só veja a oferta cujo aging da dívida se encaixa na faixa. Ex: "À vista 80% off" só aparece para dívidas com 90+ dias; "Parcelado 30% off" para 0–30 dias.

## Conceito (UX)

No diálogo "Novo modelo de acordo", abaixo de Tipo, adicionar bloco **"Aplicabilidade por aging"** com 3 modos:

1. **Qualquer aging** (default — comportamento atual, retrocompatível)
2. **Faixa única** — dois campos: `De X dias` até `Até Y dias` (Y vazio = sem limite)
3. **Presets rápidos** (chips clicáveis que preenchem a faixa):
   - `0–30` (recém-vencido)
   - `31–90` (curto prazo)
   - `91–180` (médio)
   - `181–360` (longo)
   - `360+` (prescrição próxima)

Recomendação visual: cada modelo na listagem ganha um **badge cinza** mostrando a faixa (ex: `91–180 dias`) ao lado dos badges de Destaque/Inativo, para o operador entender de relance qual oferta vai pra qual perfil.

## Lógica de matching (Portal)

- Aging = `floor((hoje - menor data_vencimento das dívidas em aberto do CPF naquele credor) / 1 dia)`.
- Se `aging_min` é null e `aging_max` é null → modelo aparece sempre (modo "Qualquer aging").
- Caso contrário: modelo aparece se `aging >= COALESCE(aging_min,0) AND aging <= COALESCE(aging_max, 99999)`.
- Filtro aplicado server-side no RPC `get_portal_agreement_templates` (recebe `_aging_days` calculado pela edge `portal-lookup` antes da chamada).
- Se nenhum modelo bater → fallback para geração dinâmica antiga (mantém compatibilidade).

## Mudanças

### 1. Migration

```sql
ALTER TABLE public.credor_agreement_templates
  ADD COLUMN aging_min_days integer,
  ADD COLUMN aging_max_days integer;

-- Atualizar RPC get_portal_agreement_templates para aceitar _aging_days
-- e filtrar: (aging_min_days IS NULL OR _aging_days >= aging_min_days)
--       AND (aging_max_days IS NULL OR _aging_days <= aging_max_days)
```

Sem default → modelos existentes ficam `NULL/NULL` = "qualquer aging" (zero quebra).

### 2. `CredorAgreementTemplates.tsx`

- Adicionar no formulário: select de modo (Qualquer / Faixa) + dois inputs `aging_min_days`, `aging_max_days` + linha de chips de preset.
- Validação: se ambos preenchidos, `min <= max`.
- Badge cinza na listagem: `0–30 dias`, `91+ dias`, `até 60 dias`, ou `Qualquer aging`.
- Preview do card já existente: adicionar linha sutil "Visível para dívidas: <faixa>".

### 3. `portal-lookup/index.ts`

- Na action `get-templates`: calcular `agingDays` a partir das parcelas em aberto do CPF/credor (`MIN(data_vencimento)` em `clients` filtrado) antes de chamar o RPC.
- Passar `_aging_days` ao RPC.

### 4. `PortalNegotiation.tsx`

- Nenhuma mudança de lógica — o filtro acontece no servidor; o componente só consome a lista já filtrada. Mantém fallback dinâmico se a lista vier vazia.

### 5. Memory

Atualizar `mem://features/portal/agreement-templates.md` documentando os campos `aging_min_days/max_days` e regra de matching.

## Garantias de não-regressão

- Templates antigos têm `aging_*` = NULL → continuam aparecendo para todos os agings.
- Fluxo interno de acordos (AgreementForm/agreementService) **não toca** nesses campos — segue ignorando a tabela.
- Edge function mantém fallback se RPC não devolver nada.
- Rollback: `UPDATE credor_agreement_templates SET aging_min_days=NULL, aging_max_days=NULL`.

## Arquivos tocados

1. `supabase/migrations/<novo>.sql` — colunas + atualização do RPC.
2. `src/components/cadastros/CredorAgreementTemplates.tsx` — UI form + badge.
3. `supabase/functions/portal-lookup/index.ts` — cálculo do aging + parâmetro extra.
4. `.lovable/memory/features/portal/agreement-templates.md` — atualização da regra.

Posso seguir com a implementação?
