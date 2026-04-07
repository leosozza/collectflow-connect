# FASE 3 — Core Canônico de Conversa e Mensagem

## Data: 2026-04-07

## Alterações no Schema

### `conversations` — Novas colunas
| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `channel_type` | text | `'whatsapp'` | Tipo de canal (whatsapp, voice, portal) |
| `provider` | text | null | Provider usado (evolution, gupshup, wuzapi) |
| `endpoint_id` | uuid | null | Referência genérica ao endpoint |
| `last_message_content` | text | null | Preview denormalizado (primeiros 200 chars) |
| `last_message_type` | text | null | Tipo da última mensagem |
| `last_message_direction` | text | null | Direção da última mensagem |

### `chat_messages` — Novas colunas
| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `provider` | text | null | Provider que processou |
| `provider_message_id` | text | null | ID no provider |
| `endpoint_id` | uuid | null | Endpoint que processou |
| `actor_type` | text | `'human'` | Quem enviou (human, ai, system, campaign) |

## Constraints de Idempotência

- `uq_conversations_tenant_instance_phone`: UNIQUE em `(tenant_id, instance_id, remote_phone)`
  - 6 duplicatas limpas (2 phones × 4 conversas cada → mantida 1 de cada)
- `uq_chat_messages_tenant_external_id`: UNIQUE parcial em `(tenant_id, external_id)` WHERE `external_id IS NOT NULL`

## Trigger de Denormalização

- `trg_chat_msg_denormalize` → `trg_denormalize_last_message()`
- Dispara em `AFTER INSERT` em `chat_messages`
- Atualiza `conversations.last_message_content/type/direction/at` quando `is_internal = false`

## Backfill Realizado

- `endpoint_id` populado a partir de `instance_id`
- `provider` populado a partir de `whatsapp_instances.provider`
- `last_message_*` populado com último `chat_messages` de cada conversa

## Otimização Frontend

- `fetchConversations()` em `conversationService.ts`:
  - **Antes**: 2 queries (conversations + batch chat_messages para preview)
  - **Depois**: 1 query (dados denormalizados na própria conversa)
  - **Ganho**: ~50% menos queries na inbox

## Impacto

- Zero breaking changes — todas as colunas são nullable ou têm defaults
- Webhooks existentes continuam funcionando sem alteração
- Frontend imediatamente mais rápido

## Próxima Fase

**Fase 4 — RPC de Ingestão Unificada**: Criar funções centralizadas para ingestão de mensagens e conversas, substituindo os lookups diretos nos webhooks.
