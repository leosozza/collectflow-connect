

## Plano — Mostrar responsável em todos os eventos do Histórico

### Problema
Hoje no `ClientTimeline.tsx`, o "responsável" só aparece quando o evento tem `metadata.created_by` / `updated_by` / `operator_id` / `agent_name`. Mas vários eventos (baixa manual, workflow, prevenção, IA, sistema) gravam o autor em outros campos (`metadata.requested_by`, `metadata.reviewed_by`, `metadata.workflow_id`, ou só em `event_source`). Resultado: muitos eventos aparecem **sem responsável**.

### Mapeamento de quem é o autor por tipo

| Origem real | Onde está no `client_events` | Como exibir |
|---|---|---|
| Operador humano (disposição, abertura/fechamento, baixa manual solicitada) | `metadata.operator_id` / `created_by` / `requested_by` | Nome do operador (lookup em `profiles`) |
| Admin (confirmou/recusou baixa manual) | `metadata.reviewed_by` | Nome do admin + tag "Admin" |
| Workflow (régua/fluxo automático) | `event_source = "workflow"` ou `metadata.source_type = "workflow"` + `metadata.workflow_id` | "Fluxo: {nome do workflow}" (lookup em `workflow_flows`) |
| Régua de prevenção | `event_source = "prevention"` | "Régua de Prevenção" |
| IA (WhatsApp / Voz) | `event_type` contém `ai_` ou `metadata.source_type = "ai_agent"` | "Agente IA" com ícone Bot |
| Negociarie / gateway externo | `event_source = "negociarie"` / `"boleto"` | "Negociarie (Boleto)" |
| Portal do devedor | `event_type` começa com `portal_` | "Portal do Devedor" |
| Sistema (auto-close, auto-expire, transferências automáticas) | `event_source = "system"` | "Sistema" com ícone Bot |
| WhatsApp inbound | `event_source = "whatsapp"` | "Cliente (WhatsApp)" |

### Mudanças (apenas `src/components/atendimento/ClientTimeline.tsx`)

**1. Expandir resolução de IDs no `profileMap`** (linhas 271-304):
Coletar também `metadata.requested_by`, `metadata.reviewed_by`, `metadata.reviewer_id`, `metadata.confirmed_by`.

**2. Buscar `workflow_flows`** (nova query): para `metadata.workflow_id` presentes nos eventos, buscar `name` para exibir "Fluxo: Cobrança D-3".

**3. Refatorar derivação de `operator`** (linhas 322-331): nova função `resolveActor(event, profileMap, workflowMap)` que retorna `{ label: string, kind: 'user' | 'admin' | 'workflow' | 'ai' | 'system' | 'portal' | 'gateway' | 'client' }`.

**4. Atualizar `ResponsibleLabel`** (linhas 208-224) para receber o objeto `actor` e renderizar:
- `user` → ícone User + nome
- `admin` → ícone Shield + "{nome} (Admin)"
- `workflow` → ícone Zap + "Fluxo: {nome}"
- `ai` → ícone Bot roxo + "Agente IA"
- `system` → ícone Bot cinza + "Sistema"
- `portal` → ícone Globe + "Portal do Devedor"
- `gateway` → ícone CreditCard + "Negociarie"
- `client` → ícone User + "Cliente"

Garantir que **sempre** renderize alguma coisa (nunca `return null`), exceto se realmente não der pra inferir nada — neste caso, exibir "Origem desconhecida" discreto.

**5. Aplicar a mesma lógica no fallback (sem client_events)** (linhas 367-401) para dispositions/agreements/callLogs.

### Sem alteração
- Schema, RLS, services, edge functions, lógica de fetch base.
- Layout do card, ordenação, paginação "Ver tudo", outros componentes.

### Arquivo
- `src/components/atendimento/ClientTimeline.tsx` — ~50 linhas adicionadas/refatoradas (nova função `resolveActor`, query `workflow_flows`, expansão do profileMap, novo `ResponsibleLabel`).

