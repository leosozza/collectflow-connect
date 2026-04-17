

## Plano — Humanizar nomenclaturas no Histórico de Atendimento

### Problema
No card "Histórico de Atendimento" do perfil do cliente aparecem labels técnicos crus como `manual_payment_requested`, `agreement_status_completed`, `manual_payment_confirmed`. Eles caem no fallback porque não estão no `EVENT_TYPE_LABELS` do `ClientTimeline.tsx`.

### Inventário de event_types sem label
Levantados nos services/edge functions:

| event_type (cru) | Label em PT |
|---|---|
| `manual_payment_requested` | Baixa Manual Solicitada |
| `manual_payment_confirmed` | Pagamento Confirmado Manualmente |
| `manual_payment_rejected` | Baixa Manual Recusada |
| `agreement_status_completed` | Acordo Quitado |
| `agreement_completed` | Acordo Quitado |
| `payment_confirmed` | Pagamento Confirmado |
| `debtor_profile_changed` | Perfil do Devedor Atualizado |
| `debtor_category` | Categoria do Devedor Definida |
| `call_hangup` | Ligação Encerrada |
| `document_previewed` | Documento Visualizado |
| `document_generated` | Documento Gerado |
| `conversation_auto_closed` | Conversa Encerrada (Inatividade) |
| `conversation_transferred` | Conversa Transferida |

### Mudanças (apenas `src/components/atendimento/ClientTimeline.tsx`)

**1. Expandir `EVENT_TYPE_LABELS`** (linhas 75-95) com as 13 entradas acima.

**2. Expandir `COLOR_MAP`** (linhas 46-73) para os novos tipos:
- `manual_payment_*` / `payment_confirmed` / `agreement_completed` / `agreement_status_completed` → verde-esmeralda (sucesso) ou amarelo (solicitação)
- `manual_payment_rejected` → vermelho
- `call_hangup` → azul (mesma família de `call`)
- `document_*` → indigo
- `debtor_profile_changed` / `debtor_category` → rosa
- `conversation_*` → violeta

**3. Expandir `TYPE_ICON`** (linhas 97-122) usando ícones já importados:
- `manual_payment_*`, `payment_confirmed` → `CreditCard`
- `agreement_completed`, `agreement_status_completed` → `Handshake`
- `call_hangup` → `Phone`
- `document_*` → `FileEdit`
- `conversation_*` → `MessageSquare` / `ArrowRightLeft`

**4. Fallback bonito**: quando o `event_type` ainda não tiver label, em vez de exibir o snake_case cru, transformar em "Title Case com espaços" (ex.: `something_new` → "Something New"). Garante que qualquer evento futuro não apareça feio.

### Sem alteração
- Schema, RLS, services, lógica de fetch.
- Estrutura do card, ordenação, paginação "Ver tudo".
- Coluna direita / outros cards.

### Arquivo
- `src/components/atendimento/ClientTimeline.tsx` — 3 mapas expandidos + 1 helper de fallback (~40 linhas adicionadas).

