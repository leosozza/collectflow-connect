

# FASE 5 — Motor de Envio Unificado + Refatoração do Chat Manual

## Estratégia de Segurança (Zero Downtime)

A abordagem é **aditiva**: criamos a nova Edge Function `send-chat-message`, atualizamos o frontend para usá-la, mas **mantemos o `evolution-proxy` intacto**. Se a nova função falhar, o `evolution-proxy` continua disponível — basta reverter uma linha no frontend.

O fluxo atual de **recebimento de mensagens (webhooks) não é tocado**.

## O Que Será Feito

### 1. Nova Edge Function `send-chat-message`

Função unificada que:
1. Valida JWT e resolve tenant do caller
2. Busca a conversa + instância (`whatsapp_instances`) pelo `conversation_id`
3. Usa o `whatsapp-sender.ts` (multiprovider) para enviar via Evolution/Gupshup/WuzAPI
4. Chama `ingest_channel_event` RPC para persistir a mensagem + atualizar conversa (status waiting→open, denormalização)
5. Retorna o message_id + conversation_id

Parâmetros: `{ conversationId, content, replyToMessageId? }`

Isso substitui o fluxo atual onde o frontend faz:
- Chamada ao `evolution-proxy?action=sendMessage` (só Evolution, hardcoded)
- INSERT manual em `chat_messages`
- UPDATE manual em `conversations`

### 2. Frontend — `conversationService.ts`

Substituir `sendTextMessage()` (~70 linhas) por uma chamada simples:
```text
fetch(`${supabaseUrl}/functions/v1/send-chat-message`, {
  method: "POST",
  headers: { Authorization, Content-Type },
  body: { conversationId, content, replyToMessageId }
})
```

Remove: busca de conversa, chamada ao evolution-proxy, INSERT em chat_messages, UPDATE em conversations — tudo isso passa a ser responsabilidade da Edge Function.

### 3. Sem alteração em `evolution-proxy`

O `evolution-proxy` continua funcionando para operações de instância (create, connect, status, delete, setWebhook). O `sendMessage` permanece lá como fallback, apenas não é mais chamado pelo chat.

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/send-chat-message/index.ts` | **Novo** — Edge Function multiprovider |
| `src/services/conversationService.ts` | Simplificar `sendTextMessage()` para chamar a nova Edge Function |

## Sem alteração em

- `evolution-proxy/index.ts` — permanece intacto
- `whatsapp-webhook/index.ts` — não tocado
- `WhatsAppChatLayout.tsx` — mesma interface (`sendTextMessage(convId, tenantId, content, instanceName, replyTo)`)

## Riscos

| Risco | Mitigação |
|---|---|
| Nova Edge Function com bug no envio | Usa o mesmo `whatsapp-sender.ts` já validado em campanhas |
| Mensagem enviada mas não persistida | RPC `ingest_channel_event` é transacional — falha atômica |
| Tenant usa Gupshup/WuzAPI no chat manual | Agora funciona (antes só Evolution era suportado no chat) |

## Resultado

- Chat manual suporta **todos os providers** (Evolution, Gupshup, WuzAPI)
- Lógica de persistência **centralizada** na RPC (fim de INSERT/UPDATE avulsos)
- `evolution-proxy` preservado como fallback
- Zero impacto no recebimento de mensagens

