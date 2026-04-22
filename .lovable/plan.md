

## Refinar a Régua de Cobrança (foco único, automação fica para depois)

### Contexto

Hoje existem 2 caminhos para disparo automático: **Régua** (`collection_rules` + `send-notifications`) e **Automação** (workflows + `workflow-engine`). O usuário decidiu: **Régua é o caminho oficial e simples para o operador**. Vamos torná-la 100% funcional. Automação fica intocada nesta iteração.

### Diagnóstico atual da Régua

**Salvamento:** funciona (verificado no banco), mas a UX falha silenciosamente em alguns casos.

**Execução (`send-notifications`):** 4 bugs impedem o disparo de prevenção:

| # | Bug | Efeito |
|---|---|---|
| 1 | `.eq("status","pendente")` | Cliente em D-3 está `em_dia`/`EM ABERTO` → nunca casa |
| 2 | Não filtra por `credor_id` da regra | Regra de Credor A dispara para clientes de Credor B |
| 3 | Ignora `instance_id` da regra | Usa só Gupshup global; quem usa Evolution não envia nada |
| 4 | Não grava `client_events` | Timeline do devedor não mostra "Régua de Prevenção" |

Bônus: sem idempotência — se o cron rodar 2x no mesmo dia, dispara 2x.

### Correções

**1. UX do formulário** (`src/components/cadastros/CredorReguaTab.tsx`)
- Validar `name` não-vazio e `daysOffset` numérico antes de salvar.
- Mostrar `err.message` real no toast (em vez do texto genérico) para o usuário entender bloqueios de RLS/permissão.
- Pequeno helper textual abaixo de "Dias": "Negativo = antes do vencimento (prevenção). 0 = no dia. Positivo = após (cobrança)."

**2. Motor de envio** (`supabase/functions/send-notifications/index.ts`)

Reescrita do loop principal mantendo a estrutura, com:

- **Status amplo:** `.in("status", ["pendente","em_dia","EM ABERTO","INADIMPLENTE"])` para aceitar prevenção e cobrança.
- **Filtro por credor:** quando `rule.credor_id` existe, adicionar `.eq("credor_id", rule.credor_id)`. Regras sem credor seguem como "globais do tenant".
- **Roteamento por instância:** se `rule.instance_id` preenchido → invocar `instance-proxy` (motor unificado Evolution/Wuzapi/Gupshup). Fallback Gupshup global apenas se a regra não tiver instância e o tenant tiver `gupshup_*` configurado.
- **Idempotência:** antes de enviar, checar `message_logs` por `(tenant_id, client_id, rule_id, date(created_at)=hoje, status='sent')`. Se existir, pular.
- **Timeline:** após `sent`, inserir em `client_events` com `event_type='message_sent'`, `event_source='prevention'` (ou `'collection'` se `days_offset >= 0`), `event_channel='whatsapp'`, `metadata` com `rule_id` e `rule_name`.

### Validação end-to-end (após deploy)

1. Criar regra D-3 num credor de teste, com instância Evolution selecionada.
2. Marcar 1 cliente desse credor com `data_vencimento = hoje + 3 dias`.
3. Invocar `send-notifications` manualmente.
4. Confirmar:
   - 1 linha em `message_logs` com `status='sent'` e `rule_id` correto.
   - 1 linha em `client_events` com `event_source='prevention'`.
   - Timeline do cliente exibe "Régua de Prevenção".
5. Re-invocar — confirmar **0 novas linhas** (idempotência).
6. Repetir teste com regra D+5 (cobrança) num cliente vencido para garantir que a refatoração não quebrou o caminho positivo.

### Detalhes técnicos

- Campos lidos da regra: `id, name, days_offset, message_template, channel, credor_id, instance_id`.
- `instance-proxy` já abstrai os 3 providers; chamada via `supabase.functions.invoke("instance-proxy", { body: { instance_id, action: "send-text", payload: { phone, text } } })`.
- `client_events`: usa `tenant_id`, `client_id`, `event_type`, `event_source`, `event_channel`, `metadata` (memória `mem://logic/atendimento/structured-history-v2`).

### Arquivos alterados

- `src/components/cadastros/CredorReguaTab.tsx` — validações + toast com erro real + helper textual.
- `supabase/functions/send-notifications/index.ts` — fix dos 4 bugs + idempotência + client_events.

### Fora de escopo

- Automação / workflows (próxima iteração, conforme combinado).
- Canal Email real (segue como `pending` no log; sem provider de envio).
- UI de "última execução" / histórico de disparos por regra (pode ser próximo passo).
- Mudar horário do cron (segue 11:00 UTC = 08:00 Brasília).

