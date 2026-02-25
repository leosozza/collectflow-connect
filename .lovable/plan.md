

## Plano: Integrar WuzAPI como Terceiro Provedor de WhatsApp

### Contexto

O WuzAPI (v3.0.0) e uma API REST multi-usuario para WhatsApp, escrita em Go com a biblioteca whatsmeow. Diferente da Evolution API (Baileys), o WuzAPI usa autenticacao por **token de usuario** (header `Token`) para endpoints de sessao/chat e **token admin** (header `Authorization`) para endpoints administrativos.

Servidor do cliente: `https://wazapi.ybrasil.com.br`

### Diferenca Chave: WuzAPI vs Evolution API

| Aspecto | Evolution API | WuzAPI |
|---------|---------------|--------|
| Auth sessao | `apikey` header global | `Token` header por usuario |
| Auth admin | Mesmo `apikey` | `Authorization` header separado |
| Criar instancia | `POST /instance/create` | `POST /admin/users` (cria usuario) |
| QR Code | `GET /instance/connect/{name}` | `GET /session/qr` (com Token) |
| Status | `GET /instance/connectionState/{name}` | `GET /session/status` (com Token) |
| Enviar texto | `POST /message/sendText/{name}` | `POST /chat/send/text` (com Token) |
| Webhook | `POST /webhook/set/{name}` | `POST /webhook` (com Token) |
| Instancia no path | Sim (nome no URL) | Nao (token identifica usuario) |

### Arquitetura

```text
WhatsAppIntegrationTab
  |-- Gupshup Card (oficial)
  |-- BaylersInstancesList (Evolution API)
  |-- WuzApiInstancesList (WuzAPI) ← NOVO
        |
        v
  wuzapiService.ts → wuzapi-proxy Edge Function → WuzAPI Server
```

### Secrets Necessarios

| Secret | Valor |
|--------|-------|
| `WUZAPI_URL` | `https://wazapi.ybrasil.com.br` |
| `WUZAPI_ADMIN_TOKEN` | Token admin definido no .env do servidor WuzAPI |

### Migracao de Banco

Adicionar campo `provider` na tabela `whatsapp_instances`:

```sql
ALTER TABLE whatsapp_instances 
ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'evolution';
```

Isso permite que o sistema saiba qual proxy usar ao enviar mensagens ou verificar status.

### Arquivos Novos

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/wuzapi-proxy/index.ts` | Edge function proxy para WuzAPI |
| `src/services/wuzapiService.ts` | Service client frontend |
| `src/components/integracao/WuzApiInstancesList.tsx` | Card UI de gerenciamento |
| `src/components/integracao/WuzApiInstanceForm.tsx` | Dialog de criacao de instancia |

### Arquivos Modificados

| Arquivo | Modificacao |
|---------|-------------|
| `src/components/integracao/WhatsAppIntegrationTab.tsx` | Adicionar card WuzAPI |
| `supabase/functions/whatsapp-webhook/index.ts` | Processar payload WuzAPI (formato diferente) |
| `supabase/config.toml` | Registrar `wuzapi-proxy` com `verify_jwt = false` |
| `src/pages/RoadmapPage.tsx` | Adicionar "Integracao WuzAPI" |

### Detalhes Tecnicos

#### 1. Edge Function `wuzapi-proxy`

Proxy autenticado que traduz acoes para endpoints WuzAPI:

| Acao | Metodo WuzAPI | Headers | Body |
|------|---------------|---------|------|
| `createUser` | `POST /admin/users` | `Authorization: ADMIN_TOKEN` | `{name, token}` |
| `deleteUser` | `DELETE /admin/users/{id}/full` | `Authorization: ADMIN_TOKEN` | — |
| `connect` | `POST /session/connect` | `Token: user_token` | — |
| `status` | `GET /session/status` | `Token: user_token` | — |
| `qrcode` | `GET /session/qr` | `Token: user_token` | — |
| `disconnect` | `POST /session/disconnect` | `Token: user_token` | — |
| `logout` | `POST /session/logout` | `Token: user_token` | — |
| `sendText` | `POST /chat/send/text` | `Token: user_token` | `{Phone, Body}` |
| `sendImage` | `POST /chat/send/image` | `Token: user_token` | `{Phone, Image, Caption}` |
| `sendDocument` | `POST /chat/send/document` | `Token: user_token` | `{Phone, Document, FileName}` |
| `sendAudio` | `POST /chat/send/audio` | `Token: user_token` | `{Phone, Audio}` |
| `setWebhook` | `POST /webhook` | `Token: user_token` | `{Url, Enabled, Events}` |
| `checkPhone` | `POST /user/check` | `Token: user_token` | `{Phone}` |
| `listUsers` | `GET /admin/users` | `Authorization: ADMIN_TOKEN` | — |

Logica do proxy:
- Valida JWT do Supabase (usuario autenticado)
- Para acoes admin (`createUser`, `deleteUser`, `listUsers`): usa `WUZAPI_ADMIN_TOKEN`
- Para acoes de sessao/chat: recebe `userToken` no body (salvo como `api_key` na tabela `whatsapp_instances`)
- Gera token aleatorio ao criar usuario (`crypto.randomUUID()`)

#### 2. Service Client `wuzapiService.ts`

Funcoes que chamam o `wuzapi-proxy`:

```text
callWuzApiProxy(action, body) → fetch wuzapi-proxy?action=X
createWuzApiUser(name) → createUser
deleteWuzApiUser(userId) → deleteUser
connectWuzApiSession(userToken) → connect
getWuzApiStatus(userToken) → status
getWuzApiQrCode(userToken) → qrcode
disconnectWuzApiSession(userToken) → disconnect
sendWuzApiText(userToken, phone, body) → sendText
setWuzApiWebhook(userToken) → setWebhook
```

#### 3. WuzApiInstancesList (UI)

Card seguindo o mesmo padrao do `BaylersInstancesList`:
- Titulo: "WuzAPI (QR Code)"
- Descricao: "Conexao via WuzAPI — servidor proprio"
- Botao "Nova Instancia" → dialog com campo nome
- Ao criar:
  1. Chama `createUser` no WuzAPI (gera token aleatorio)
  2. Salva na tabela `whatsapp_instances` com `provider = 'wuzapi'` e `api_key = token gerado`
  3. Configura webhook automaticamente
- Lista de instancias com:
  - Nome, status (conectado/desconectado), telefone
  - Botoes: QR Code, Status, Webhook, Editar, Excluir
- QR Code em dialog com polling de status (mesmo fluxo do BaylersInstancesList)
- Badge "WuzAPI" para distinguir visualmente

#### 4. Webhook — Processamento WuzAPI

O WuzAPI envia webhooks com formato diferente do Evolution API. O payload segue este padrao:

```json
{
  "type": "Message",
  "event": "message",
  "data": {
    "Info": { "Id": "...", "RemoteJid": "5511...@s.whatsapp.net", "FromMe": false, "Timestamp": 1234 },
    "Message": { "Conversation": "texto aqui" },
    "MediaType": "",
    "Source": { "Sender": { "User": "5511...", "PushName": "Nome" } }
  }
}
```

O `whatsapp-webhook` sera atualizado para detectar o formato WuzAPI (presenca de campo `type` como "Message") e normalizar para o mesmo formato interno que ja processa mensagens Evolution.

Deteccao do provedor no webhook:
- Se `body.event` existe → formato Evolution API (atual)
- Se `body.type` existe e `body.event` = "message" → formato WuzAPI
- Usar query param `?provider=wuzapi` como fallback

#### 5. Fluxo Completo do Usuario

```text
1. Admin acessa Integracoes → WhatsApp
2. Ve 3 cards: Gupshup, Evolution API (QR), WuzAPI (QR)
3. No card WuzAPI, clica "Nova Instancia"
4. Informa apelido → sistema cria usuario no WuzAPI
5. Clica "Conectar" → chama /session/connect, depois /session/qr
6. Exibe QR Code → escaneia no celular
7. Polling /session/status detecta conexao → "Conectado"
8. Webhook configurado automaticamente
9. Mensagens recebidas/enviadas funcionam identico ao Evolution
```

#### 6. Layout WhatsAppIntegrationTab

```text
+---------------------------+---------------------------+
| Gupshup (Oficial)         | Evolution API (QR Code)   |
| [configuracao atual]      | [BaylersInstancesList]    |
+---------------------------+---------------------------+
| WuzAPI (QR Code)          |                           |
| [WuzApiInstancesList]     |                           |
+---------------------------+---------------------------+
```

Grid ajustado para `md:grid-cols-2` com WuzAPI como terceiro card.

### Consideracoes

- O WuzAPI requer servidor hospedado pelo cliente (ja hospedado em `wazapi.ybrasil.com.br`)
- Cada instancia no RIVO = 1 usuario no WuzAPI
- O token do usuario e salvo como `api_key` na tabela `whatsapp_instances`
- O campo `provider` permite routing correto ao enviar mensagens pelo chat
- Os secrets `WUZAPI_URL` e `WUZAPI_ADMIN_TOKEN` precisam ser configurados antes da implementacao

