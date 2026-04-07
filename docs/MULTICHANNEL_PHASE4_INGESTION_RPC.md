# Fase 4 — RPC Transacional de Ingestão Canônica

## Visão Geral

A função `ingest_channel_event` centraliza **toda** a lógica de ingestão de mensagens em uma única transação PostgreSQL. Webhooks e campanhas agora são apenas parsers de payload que chamam esta RPC.

## Arquitetura

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Evolution/Baylers│   │    Gupshup       │   │   Campanhas      │
│    Webhook       │   │    Webhook       │   │   Bulk Send      │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │ parse                │ parse                │ send+parse
         ▼                      ▼                      ▼
   ┌─────────────────────────────────────────────────────────┐
   │              ingest_channel_event(RPC)                  │
   │                                                         │
   │  1. Normaliza telefone                                  │
   │  2. Resolve cliente (client_phones)                     │
   │  3. Encontra/cria conversa                              │
   │  4. Fluxo de status (closed→waiting)                    │
   │  5. Deduplica por external_id                           │
   │  6. Insere chat_message                                 │
   │  7. Trigger denormaliza last_message_*                   │
   │  8. Calcula SLA (credor→tenant fallback)                │
   │  9. Round-robin para novas conversas inbound            │
   └─────────────────────────────────────────────────────────┘
```

## Parâmetros da RPC

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `_tenant_id` | uuid | Tenant que recebe/envia |
| `_endpoint_id` | uuid | ID da instância/endpoint |
| `_channel_type` | text | `'whatsapp'`, `'voice'`, `'portal'` |
| `_provider` | text | `'evolution'`, `'gupshup'`, `'wuzapi'`, `'meta'` |
| `_remote_phone` | text | Telefone do contato |
| `_remote_name` | text | Nome do contato (pushName) |
| `_direction` | text | `'inbound'` ou `'outbound'` |
| `_message_type` | text | `'text'`, `'image'`, `'audio'`, etc. |
| `_content` | text | Conteúdo da mensagem |
| `_media_url` | text | URL de mídia |
| `_media_mime_type` | text | MIME type da mídia |
| `_external_id` | text | ID externo do provider |
| `_provider_message_id` | text | ID no provider |
| `_actor_type` | text | `'human'`, `'ai'`, `'system'`, `'campaign'` |
| `_status` | text | `'sent'`, `'delivered'`, etc. |

## Retorno

```json
{
  "conversation_id": "uuid",
  "message_id": "uuid",
  "is_new_conversation": true,
  "client_id": "uuid or null",
  "skipped_duplicate": false
}
```

## Webhooks Refatorados

### `whatsapp-webhook` (~160 linhas, era ~385)
- Mantém parsing de payload Evolution
- Mantém handler de `connection.update` (estado da instância)
- Mantém handler de `messages.update` (status de mensagem)
- `messages.upsert` → parse → `ingest_channel_event`

### `gupshup-webhook` (~150 linhas, era ~64 mas não funcionava para inbox)
- Agora processa mensagens inbound → `ingest_channel_event`
- Mantém atualização de status em `chat_messages` e `message_logs`
- Resolução de tenant por instância Gupshup ou `gupshup_source_number`

### `send-bulk-whatsapp` → `ensureConversationAndMessage`
- Substituído por chamada a `ingest_channel_event` com `actor_type = 'campaign'`
- Mesma interface externa, mesma lógica de envio

## Benefícios

- **Uma fonte de verdade** para ingestão
- **Transacionalidade** real (sem race conditions)
- **Gupshup inbound funcional** na inbox
- **Campanhas** usam o mesmo pipeline
- Adicionar novo provider = criar novo parser (~100 linhas)

## Próximas Fases

- **Fase 5**: Motor de envio unificado + chat manual refatorado
- **Fase 6**: Dashboard e relatórios multicanal
