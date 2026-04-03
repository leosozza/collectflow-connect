

# Plano: Melhorias Operacionais WhatsApp — Fila, SLA Timer, Filtro Não Lidas, Reply

## Resumo

4 melhorias operacionais independentes no módulo WhatsApp. Nenhuma alteração em campanhas, automação, templates ou permissões.

## Parte 1 — Fila de Conversas (waiting → open)

**Webhook (`whatsapp-webhook/index.ts`)**:
- Linha 232: incluir `status` no select da conversa existente
- Linha 251: substituir `updateData.status = "open"` por lógica condicional:
  - `closed` → `waiting`
  - `waiting` → manter
  - `open` → manter
- Linha 290: nova conversa inbound → `status: "waiting"` (era `"open"`)
- SLA continua recalculando normalmente

**ChatPanel (`ChatPanel.tsx`)**:
- Quando `conversation.status === "waiting"`, renderizar banner entre header e mensagens:
  - Texto: "Conversa aguardando atendimento"
  - Botão: "Aceitar Conversa" → `onStatusChange("open")`
  - Estilo discreto (bg-amber-50, ícone Clock)

**Service (`conversationService.ts`)**:
- `sendTextMessage()`: incluir `status` no select da conversa
- Após envio bem-sucedido, se `status === "waiting"`, atualizar para `"open"` (auto-aceitar)

## Parte 2 — Timer SLA no Header

**ChatPanel (`ChatPanel.tsx`)**:
- Novo estado `slaRemaining` com `useEffect` + `setInterval` a cada 30s
- Quando `slaDeadline` existe e não expirou: badge discreta `⏱ HH:MM`
  - Verde (>50% restante), Amarelo (≤25%), Vermelho ao expirar
- Quando expirado: manter badge "SLA Expirado" existente (sem mudança)

## Parte 3 — Filtro "Não Lidas"

**ConversationList (`ConversationList.tsx`)**:
- Adicionar pill "Não lidas" ao array `statusPills` com contagem de `unread_count > 0`
- No filtro: quando `statusFilter === "unread"`, filtrar por `c.unread_count > 0`
- Manter todos os outros filtros funcionando

## Parte 4 — Responder Mensagem Específica

**Migration**: Adicionar coluna `reply_to_message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL` à tabela `chat_messages`.

**ChatMessage (`ChatMessage.tsx`)**:
- Adicionar botão de reply (ícone Reply) visível ao hover em mensagens inbound
- Prop `onReply(message)` para notificar o pai
- Quando mensagem tem `reply_to_message_id`: renderizar bloco de preview acima da bolha (barra lateral colorida + trecho da mensagem original)
- Receber `allMessages` como prop para lookup local do conteúdo original

**ChatInput (`ChatInput.tsx`)**:
- Nova prop `replyTo?: ChatMessage | null` + `onCancelReply?: () => void`
- Quando `replyTo` definido: renderizar barra acima do input com trecho + botão X
- Estilo WhatsApp: barra lateral verde, texto truncado

**ChatPanel (`ChatPanel.tsx`)**:
- Estado `replyTo` para mensagem selecionada
- Passar `onReply` ao `ChatMessageBubble`, `replyTo`/`onCancelReply` ao `ChatInput`
- Ao enviar, incluir `reply_to_message_id` e limpar estado
- Passar `messages` como `allMessages` para lookup de reply

**Service (`conversationService.ts`)**:
- `ChatMessage` interface: adicionar `reply_to_message_id?: string | null`
- `sendTextMessage()`: aceitar `replyToMessageId` opcional, gravar no insert
- `sendInternalNote()`: sem mudança (notas não usam reply)

**Webhook**: sem mudança (campo nullable, webhook não precisa gravar reply)

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | `ALTER TABLE chat_messages ADD COLUMN reply_to_message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL` |
| `supabase/functions/whatsapp-webhook/index.ts` | Status `waiting` para inbound, lógica condicional em existente |
| `src/components/contact-center/whatsapp/ChatPanel.tsx` | Banner waiting, timer SLA, estado replyTo |
| `src/components/contact-center/whatsapp/ChatInput.tsx` | Preview de reply acima do input |
| `src/components/contact-center/whatsapp/ChatMessage.tsx` | Botão reply ao hover, preview de mensagem respondida |
| `src/components/contact-center/whatsapp/ConversationList.tsx` | Pill "Não lidas" |
| `src/services/conversationService.ts` | Auto-aceitar waiting, `reply_to_message_id` no envio e interface |

Nenhuma alteração em: campanhas, automação, templates, permissões, disparo da carteira, acordos.

