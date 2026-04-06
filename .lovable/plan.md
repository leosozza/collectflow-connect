

# Plano: Corrigir erro de número e criar conversas nos disparos em lote

## Dois problemas identificados

### 1. Erro no número da Pamela (5596981237461)

O número `5596981237461` tem 13 dígitos e começa com `55`, então `normalizePhoneBR` o retorna sem alteração. Porém a Evolution API responde `"exists": false` — isso significa que **o número simplesmente não existe no WhatsApp**. Não é bug de formatação.

Possível causa: o número original no banco pode ter um dígito a mais (o `9` inserido indevidamente em telefone fixo ou de região que não usa 9). DDD 96 (Amapá) usa 9 em celulares, mas se o número original era `96981237461` (11 dígitos), o sistema prefixou `55` corretamente para `5596981237461`. O problema é que esse número não está registrado no WhatsApp.

**Ação**: Nenhuma correção de código necessária — o número não existe no WhatsApp. Esse tipo de falha é esperado e já é registrado como `failed` nos logs.

### 2. Conversas não aparecem na aba WhatsApp CRM

**Causa raiz**: O `send-bulk-whatsapp` envia a mensagem via API da Evolution mas **não cria um registro na tabela `conversations`** nem insere a mensagem em `chat_messages`. Conversas só são criadas pelo webhook (`whatsapp-webhook`) quando chega uma mensagem **inbound** ou quando a Evolution envia um evento `messages.upsert` com `fromMe: true`.

O webhook depende de receber o evento da Evolution. Se o webhook não está configurado na instância "DISPAROS VITOR 1", ou se a Evolution não dispara eventos para mensagens enviadas via API, as conversas nunca são criadas.

**Correção proposta**: Após cada envio bem-sucedido no `send-bulk-whatsapp`, criar ou atualizar a conversa e inserir a mensagem outbound em `chat_messages`. Isso garante que toda mensagem enviada apareça no CRM.

### Alterações em `supabase/functions/send-bulk-whatsapp/index.ts`

Criar uma função auxiliar `ensureConversationAndMessage` que:
1. Busca a conversa existente por `tenant_id` + `instance_id` + `remote_phone` (telefone normalizado)
2. Se não existir, cria com status `"open"`, vinculando ao `client_id` se disponível
3. Insere a mensagem outbound em `chat_messages` com `external_id` do provider
4. Atualiza `last_message_at` da conversa

Chamar essa função após cada envio bem-sucedido, tanto no `handleCampaignFlow` quanto no `handleLegacyFlow`.

```text
Envio OK → ensureConversationAndMessage(tenantId, instanceId, normalizedPhone, clientName, clientId, message, providerMessageId)
         → conversations: upsert (create if missing, update last_message_at)
         → chat_messages: insert outbound record
```

### Impacto

- Todas as mensagens enviadas em lote passarão a aparecer na aba Conversas do WhatsApp CRM
- O operador poderá ver o histórico de disparos e continuar a conversa
- Nenhuma alteração no frontend ou no banco de dados (tabelas `conversations` e `chat_messages` já existem)

| Arquivo | Alteração |
|---|---|
| `supabase/functions/send-bulk-whatsapp/index.ts` | Adicionar `ensureConversationAndMessage` e chamar após envio OK |

