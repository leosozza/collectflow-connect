

# Plano: Corrigir integração bidirecional — Socket.IO em vez de webhooks REST

## Diagnóstico

A API 3CPlus **não possui** endpoint `/campaigns/{id}/webhooks`. Confirmei na documentação oficial (Swagger) que não existe nenhum endpoint de webhooks REST para campanhas.

A 3CPlus usa **Socket.IO** para eventos em tempo real. Os eventos disponíveis incluem:
- `call-was-created`, `call-was-answered`, `call-was-connected`
- `call-was-ended`, `call-was-finished`, `call-was-abandoned`
- `agent-is-idle`, `agent-in-acw`, `agent-entered-work-break`
- `call-history-was-created` (contém dados completos da chamada)

A conexão socket usa: `io("SOCKET_SERVER_ADDR", { transports: ['websocket'], query: { token: "api_token" } })`

## Abordagem corrigida

Como Edge Functions do Deno não suportam conexões WebSocket persistentes (socket.io client), a integração bidirecional precisa funcionar de duas formas:

### Opção A: Webhook manual (já implementado, funciona)
O arquivo `threecplus-webhook/index.ts` já está pronto para receber POSTs. O webhook precisa ser configurado **manualmente no painel da 3CPlus** (não via API). A URL já foi fornecida ao usuário.

### Opção B: Polling otimizado + registro automático de chamadas
Usar o endpoint `GET /calls` com filtros de data para buscar chamadas finalizadas e registrar automaticamente em `call_logs`.

## Mudanças propostas

### 1. `src/components/contact-center/threecplus/CampaignsPanel.tsx`
- **Remover** o toggle de "Webhook Bidirecional" que tenta chamar `register_webhook` (endpoint inexistente)
- **Substituir** por um card informativo com a URL do webhook para configuração manual no painel 3CPlus, com botão de copiar
- Adicionar badge de status que verifica se o webhook está recebendo dados (checa `call_logs` recentes com `source = 'webhook'`)

### 2. `supabase/functions/threecplus-proxy/index.ts`
- **Remover** as ações `register_webhook`, `list_webhooks`, `delete_webhook` (endpoints inexistentes na API 3CPlus)
- Manter tudo mais intacto

### 3. `src/components/admin/integrations/ThreeCPlusTab.tsx`
- Remover a verificação de webhooks via API (que falha)
- Verificar status bidirecional checando se existem `call_logs` recentes com source webhook

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/contact-center/threecplus/CampaignsPanel.tsx` | Trocar toggle por card informativo com URL do webhook + botão copiar |
| `supabase/functions/threecplus-proxy/index.ts` | Remover 3 ações de webhook inexistentes |
| `src/components/admin/integrations/ThreeCPlusTab.tsx` | Ajustar verificação de status bidirecional |

