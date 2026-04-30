## Problema

Quando o cliente seleciona uma mensagem nossa no WhatsApp e responde citando-a, o RIVO recebe a mensagem mas **não exibe** que é uma resposta a uma mensagem específica. No envio (operador → cliente) o reply já funciona — o gargalo está na **ingestão de mensagens inbound**.

## Diagnóstico

1. A coluna `chat_messages.reply_to_message_id` existe e a UI (`ChatMessage.tsx`) já renderiza o bloco de citação quando ela está preenchida.
2. O webhook **`whatsapp-webhook`** (Evolution/Baileys) faz parsing de `msg.conversation`, `extendedTextMessage`, etc., **mas ignora completamente o `contextInfo`** que o WhatsApp envia junto da mensagem citada.
3. O webhook **`gupshup-webhook`** também não lê o `context.id` que o Gupshup envia em mensagens citadas.
4. A RPC `ingest_channel_event` (e o wrapper v2) não aceita parâmetro de reply, então mesmo que o webhook tivesse o ID, ele não seria persistido.

Resultado: toda resposta citada do cliente perde a referência → aparece como mensagem solta.

## O que entrega o WhatsApp / Evolution

```
msg.extendedTextMessage.contextInfo = {
  stanzaId: "<external_id da mensagem original>",
  participant: "<jid>",
  quotedMessage: { ... }
}
```
O mesmo `contextInfo` aparece em `imageMessage`, `audioMessage`, `videoMessage`, `documentMessage` e `stickerMessage`. No Gupshup vem em `payload.context.id`.

## Solução

### 1. Migration — estender a RPC de ingestão

Adicionar parâmetro `_reply_to_external_id text DEFAULT NULL` em:
- `public.ingest_channel_event(...)`
- `public.ingest_channel_event_v2(...)` (apenas repassa)

Dentro da v1, antes do INSERT em `chat_messages`:
- Se `_reply_to_external_id` informado, fazer lookup:
  ```sql
  SELECT id INTO _reply_to_msg_id
  FROM chat_messages
  WHERE tenant_id = _tenant_id
    AND external_id = _reply_to_external_id
  LIMIT 1;
  ```
- Incluir `reply_to_message_id = _reply_to_msg_id` no INSERT.
- Se a mensagem original não for encontrada (corner case: usuário citou mensagem antiga não importada), o campo fica NULL e a UI segue funcionando normalmente.

Nota: tanto mensagens inbound quanto outbound já gravam `external_id` como o `key.id` do WhatsApp, então o lookup casa para os dois lados (cliente respondendo nossa msg, ou nós respondendo a dele).

### 2. `whatsapp-webhook/index.ts` — extrair contextInfo

No bloco de parsing (linhas 129-156), após identificar o tipo, ler o `contextInfo` correspondente:

```ts
const ctx =
  msg?.extendedTextMessage?.contextInfo ||
  msg?.imageMessage?.contextInfo ||
  msg?.audioMessage?.contextInfo ||
  msg?.videoMessage?.contextInfo ||
  msg?.documentMessage?.contextInfo ||
  msg?.stickerMessage?.contextInfo ||
  null;
const replyToExternalId = ctx?.stanzaId || null;
```

Passar `_reply_to_external_id: replyToExternalId` na chamada `supabase.rpc("ingest_channel_event_v2", ...)`.

### 3. `gupshup-webhook/index.ts` — extrair context.id

No parser de mensagens inbound do Gupshup, extrair `payload.context?.id` (ou equivalente conforme o formato atual) e passar para a RPC do mesmo modo.

### 4. UI — nada a mudar

`ChatMessage.tsx` já procura `allMessages.find(m => m.id === message.reply_to_message_id)` e renderiza a citação com nome/conteúdo. Funcionará automaticamente assim que o backend popular o campo.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — nova versão de `ingest_channel_event` + `ingest_channel_event_v2`.
- `supabase/functions/whatsapp-webhook/index.ts` — extrair `contextInfo.stanzaId` e passar para a RPC.
- `supabase/functions/gupshup-webhook/index.ts` — extrair `context.id` e passar para a RPC.

## Casos de borda tratados

- Mensagem citada não existe no banco → `reply_to_message_id` fica NULL, mensagem entra normal.
- Mensagem citada é de antes da migration → mesmo comportamento, sem erro.
- Citação a uma mídia (áudio, imagem, doc) → funciona igual, é só `external_id`.
- Mensagens duplicadas (já bloqueadas pelo dedup atual de `external_id`) → comportamento inalterado.
