

## Plano: restringir exclusão de conversa + excluir/editar mensagens (oficial e não oficial)

### 1) Excluir conversa — somente ADMIN

A lista já recebe `isAdmin` e o item "Excluir conversa" (`ConversationList.tsx` linhas 568-578) já está condicionado a `isAdmin && onDelete`. Vamos **reforçar essa proteção** garantindo que `WhatsAppChatLayout.tsx` só passe `onDelete` quando `isAdmin` for `true` (defesa em profundidade — hoje passa sempre). Operadores deixam de ver a opção no menu de contexto.

### 2) Menu de ações na bolha da mensagem

No componente `ChatMessage.tsx` (bolha individual), adicionar um menu pop-over (ícone `MoreVertical` que aparece no hover, padrão WhatsApp) com:

- **Responder** (já existe como botão lateral; mover para dentro do menu).
- **Editar mensagem** — disponível somente para mensagens **outbound**, **status ≠ failed**, **message_type = "text"** e enviadas há menos de **15 minutos** (limite do WhatsApp).
- **Excluir para o destinatário** — disponível para **outbound** com `provider_message_id` presente. Funciona para texto, áudio, imagem, vídeo, documento e sticker.

### 3) Comportamento "excluir para o cliente, manter na Rivo"

A mensagem **continua existindo** em `chat_messages` (auditoria total). Adicionamos colunas:

- `deleted_for_recipient_at timestamptz` — quando foi solicitado o delete-for-everyone no provider.
- `deleted_by uuid` — `profile_id` do operador que apagou.
- `edited_at timestamptz` e `original_content text` — para edição (manter histórico do texto original).

A bolha renderiza:
- Quando `deleted_for_recipient_at != null`: texto/legenda em **strikethrough** + opacidade 50% + ícone pequeno de "Trash2" + tooltip "Excluída para o cliente em {data} por {operador}". Mídia (áudio/imagem/documento/vídeo) também recebe overlay esmaecido com strikethrough no caption/nome do arquivo, mas o conteúdo continua visível e tocável dentro da Rivo.
- Quando `edited_at != null`: pequeno rótulo "editada" ao lado do horário (padrão WhatsApp), com tooltip mostrando o texto original.

### 4) Suporte por provider (oficial e não oficial)

| Provider | Excluir para todos | Editar mensagem |
|---|---|---|
| **Evolution / Baylers** (não oficial) | `DELETE /chat/deleteMessageForEveryone/{instance}` com `{ id, remoteJid, fromMe, participant? }` | `POST /chat/updateMessage/{instance}` com `{ number, key, text }` |
| **Gupshup** (oficial Meta) | `DELETE https://api.gupshup.io/wa/api/v1/msg/{messageId}` (somente nas últimas ~48h conforme Meta) | Não suportado pela API oficial — opção **fica desabilitada** com tooltip "Edição não suportada nas instâncias oficiais" |
| **WuzAPI** | `POST /chat/delete` com `{ phone, messageId, fromMe: true }` | `POST /chat/edit` com `{ phone, id, body }` |

A função decide pelo `provider` (mesmo padrão do `whatsapp-sender.ts`). Se o provider não suportar, retorna 400 com mensagem clara — UI já exibe o item desabilitado.

### 5) Edge function nova: `manage-chat-message`

Arquivo: `supabase/functions/manage-chat-message/index.ts`

Aceita `POST` com `{ messageId, action: "delete" | "edit", newText? }`.

Fluxo:
1. JWT do operador → resolve `tenant_id` (defesa multi-tenant).
2. SELECT mensagem + conversation + instance (uma única query com joins).
3. Validações: outbound, mesmo tenant, idade ≤ 15 min para edit, `provider_message_id` presente para delete.
4. Chama provider apropriado (helpers `deleteByProvider` e `editByProvider` em `_shared/whatsapp-sender.ts`).
5. Se sucesso → UPDATE `chat_messages` setando `deleted_for_recipient_at` ou `edited_at` + `original_content` + `content` novo, e registra evento em `client_events` (tipo `message_deleted` / `message_edited`).
6. Se falhar no provider → retorna erro detalhado, **não atualiza** a mensagem na Rivo.

### 6) Permissões

Qualquer operador autorizado a enviar mensagens pode editar/excluir suas mensagens. Admin pode editar/excluir mensagens enviadas por outros operadores. (A regra fica no edge function: `is_tenant_admin` OU `chat_messages.metadata.sent_by_profile_id === current_profile`.)

### 7) Realtime / UI otimista

- Ao confirmar delete/edit, o frontend faz UPDATE otimista no `messages` local; o realtime UPDATE da tabela confirma para os outros operadores conectados.
- Adicionar listener UPDATE no canal de mensagens existente (hoje ouve só INSERT — incluir `event: '*'`).

### Arquivos alterados

1. **Migration**: adicionar colunas `deleted_for_recipient_at`, `deleted_by`, `edited_at`, `original_content` em `chat_messages` + atualizar políticas RLS de UPDATE para permitir somente operador autor ou admin.
2. **`supabase/functions/_shared/whatsapp-sender.ts`**: novas funções `deleteByProvider` e `editByProvider` (Evolution + Gupshup + WuzAPI).
3. **`supabase/functions/manage-chat-message/index.ts`**: nova edge function.
4. **`src/services/conversationService.ts`**: novos helpers `deleteChatMessageForRecipient(id)` e `editChatMessage(id, newText)` que invocam a edge.
5. **`src/components/contact-center/whatsapp/ChatMessage.tsx`**: menu de ações na bolha (MoreVertical + DropdownMenu), renderização strikethrough/opaca quando deletada, rótulo "editada" + tooltip do texto original, dialog inline para editar.
6. **`src/components/contact-center/whatsapp/ChatPanel.tsx`**: listener UPDATE no realtime (incluir evento UPDATE).
7. **`src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`**: passar `onDelete` somente quando `isAdmin === true`.

### Validação

1. **Operador comum** abre `/contact-center/whatsapp` → menu de contexto da conversa **não mostra** "Excluir conversa".
2. **Admin** vê e consegue excluir conversa normalmente.
3. **Editar texto** numa instância Evolution (≤15min) → mensagem atualiza no WhatsApp do cliente; bolha mostra "editada" e tooltip com texto original.
4. **Editar texto** em instância Gupshup oficial → opção aparece **desabilitada** com tooltip explicativo.
5. **Excluir mensagem de texto** em Evolution → some do WhatsApp do cliente; na Rivo aparece riscada/esmaecida com tooltip "Excluída por X em Y".
6. **Excluir áudio/imagem/documento/vídeo** em Evolution → mídia continua tocável/visualizável na Rivo, com overlay esmaecido + ícone de exclusão; no celular do cliente vira "Esta mensagem foi apagada".
7. **Excluir mensagem em Gupshup** → mesmo comportamento (oficial Meta aceita delete em até 48h).
8. **Falha no provider** (instância offline) → toast de erro, mensagem **não** vira "deletada" na Rivo; estado consistente.
9. Outro operador conectado vê o estado "deletada/editada" atualizar em tempo real (via realtime UPDATE).

