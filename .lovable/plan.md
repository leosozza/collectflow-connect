## Problema

Quando o operador é bloqueado (após 5 mensagens recebidas) por falta de perfil ou tabulação, ele preenche os dados na sidebar mas o gate **não libera automaticamente** — só após F5. Resultado: má experiência e operadores recarregando a página o tempo todo.

## Causa raiz

O cálculo `mustGate` no `ChatPanel.tsx` depende de duas fontes de estado mantidas em `WhatsAppChatLayout.tsx`:

1. **`dispositionAssignments`** — carregado uma única vez no `useEffect` que depende de `conversations.length` (linha 199). Quando o operador adiciona uma tabulação via `DispositionSelector`, esse estado **nunca é atualizado** localmente.
2. **`clientInfo.debtor_profile`** — já tem realtime via canal `client-detail-${clientId}` (linha 487), então essa parte funciona. Porém, o componente `DebtorCategoryPanel` na sidebar atualiza apenas o estado local `linkedClient` da `ContactSidebar` e não dispara re-fetch — o realtime do Postgres deveria cobrir, mas só funciona se o update realmente persiste em `clients.debtor_profile`.

Conclusão: o gate de **tabulação nunca se atualiza** sem refresh, e o de **perfil** depende de o realtime entregar o UPDATE da tabela `clients`.

## Solução

### 1. Realtime para tabulações de conversa
Em `WhatsAppChatLayout.tsx`, adicionar um canal Supabase Realtime escutando `conversation_disposition_assignments` filtrado por `tenant_id`, atualizando o estado `dispositionAssignments` em INSERT/UPDATE/DELETE.

```text
channel: dispositions-realtime-${tenantId}
table: conversation_disposition_assignments
event: * (INSERT, UPDATE, DELETE)
→ atualiza setDispositionAssignments(prev => merge/remove)
```

### 2. Callback imediato (otimista) no DispositionSelector
Adicionar prop opcional `onAssigned(conversationId, dispositionTypeId)` em `DispositionSelector.tsx`. Após o `insert` bem-sucedido, chamar o callback para que `WhatsAppChatLayout` atualize `dispositionAssignments` **imediatamente**, sem depender da latência do realtime.

Encadear nas props: `ContactSidebar` → `DispositionSelector` → callback.

### 3. Garantir realtime do perfil do devedor
Verificar que `DebtorCategoryPanel` (usado na sidebar) realmente faz `UPDATE clients SET debtor_profile = ...`. Se sim, o canal já existente em `WhatsAppChatLayout` (linha 487) cuida da atualização. Adicionar também callback otimista `onProfileChanged` propagando para o pai `WhatsAppChatLayout` para zero-latência (atualmente só atualiza `linkedClient` interno da `ContactSidebar`, não o `clientInfo` do layout).

### 4. Verificação cruzada — tabulação alimenta o perfil?

Análise solicitada anteriormente:
- **Tabulação WhatsApp** (`DispositionSelector.tsx` linha 102): faz insert em `conversation_disposition_assignments` e em `call_dispositions` via `dispositionService.createDisposition`, que por sua vez chama `applyAutoProfileFromDisposition` → atualiza `clients.debtor_profile` quando o tipo de tabulação tem `auto_profile` configurado.
- **Tabulação Discador** (`DispositionPanel.tsx` em `atendimento`): mesma rota — chama `dispositionService.createDisposition` → `applyAutoProfileFromDisposition`.

Ambos abastecem corretamente. Apenas confirmar com 1 leitura rápida do `dispositionAutomationService` para garantir que continua atualizando `clients.debtor_profile` (e não só `client_profiles`).

## Arquivos afetados

- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` — novo canal realtime + callbacks otimistas para `setDispositionAssignments` e `setClientInfo`
- `src/components/contact-center/whatsapp/DispositionSelector.tsx` — nova prop `onAssigned`, chamada após insert
- `src/components/contact-center/whatsapp/ContactSidebar.tsx` — encadear `onAssigned` e `onProfileChanged` para o pai
- `src/components/atendimento/DebtorCategoryPanel.tsx` — confirmar prop `onProfileChanged` já existe (já vista) e que faz UPDATE em `clients`

## Resultado esperado

- Operador adiciona tabulação → banner amarelo `WhatsAppGateBanner` desaparece em <500ms, input desbloqueia.
- Operador define perfil → mesmo comportamento.
- Sem necessidade de F5.
- Funciona em outros operadores conectados na mesma conversa (via realtime).