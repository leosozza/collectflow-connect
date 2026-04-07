

# FASE 3 — Core Canônico de Conversa e Mensagem

## Situação Atual

### `conversations` (145 registros: 89 waiting, 56 open)
- **14 colunas** — sem `channel_type`, `provider`, `endpoint_id`, sem denormalização de última mensagem
- **Sem constraint UNIQUE** em `(tenant_id, instance_id, remote_phone)` — deduplicação apenas por query
- `instance_id` aponta para `whatsapp_instances` — funcional mas acoplado ao nome "whatsapp"
- Inbox faz **query extra** em `chat_messages` para buscar preview da última mensagem (batch de até 50 IDs)

### `chat_messages` (802 registros)
- **13 colunas** — sem `provider`, `provider_message_id`, `actor_type`
- `external_id` **sem UNIQUE constraint** — deduplicação por SELECT antes de INSERT (race condition)
- Sem rastreabilidade de qual provider/endpoint enviou/recebeu

### `whatsapp_instances`
- Já tem `provider`, `provider_category`, capabilities (`supports_*`) — boa base para endpoint

### Frontend (`conversationService.ts`)
- `fetchConversations()` faz join com `clients(nome_completo)` + batch query em `chat_messages` para preview
- Com denormalização, essa segunda query desaparece

---

## O Que Será Feito

### 1. Migration — Adicionar colunas multiprovider em `conversations`

Novas colunas:
- `channel_type` (text, default `'whatsapp'`) — tipo de canal (whatsapp, voice, portal)
- `provider` (text, nullable) — provider usado (evolution, gupshup, wuzapi, meta)
- `endpoint_id` (uuid, nullable) — referência genérica ao endpoint (hoje = whatsapp_instances.id, equivalente a instance_id)
- `last_message_content` (text, nullable) — preview denormalizado
- `last_message_type` (text, nullable) — tipo da última mensagem
- `last_message_direction` (text, nullable) — direction da última mensagem

### 2. Migration — Adicionar colunas multiprovider em `chat_messages`

Novas colunas:
- `provider` (text, nullable) — provider que processou esta mensagem
- `provider_message_id` (text, nullable) — ID no provider (separado do external_id)
- `endpoint_id` (uuid, nullable) — endpoint que processou
- `actor_type` (text, default `'human'`) — quem enviou (human, ai, system, campaign)

### 3. Migration — Constraint UNIQUE para idempotência

- `conversations`: UNIQUE em `(tenant_id, instance_id, remote_phone)` — **limpar duplicatas primeiro** se existirem
- `chat_messages`: UNIQUE parcial em `(tenant_id, external_id)` WHERE `external_id IS NOT NULL` — elimina race condition na dedup

### 4. Migration — Trigger de denormalização de última mensagem

Criar trigger `AFTER INSERT` em `chat_messages` (quando `is_internal = false`) que atualiza `conversations` com:
- `last_message_content` = conteúdo truncado (primeiros 200 chars)
- `last_message_type` = message_type
- `last_message_direction` = direction
- `last_message_at` = created_at

### 5. Migration — Popular colunas existentes

- Preencher `channel_type = 'whatsapp'` para todas conversations existentes
- Copiar `instance_id` → `endpoint_id` para todas conversations
- Popular `provider` em conversations a partir de `whatsapp_instances.provider`
- Popular `last_message_*` com dados atuais de `chat_messages`

### 6. Frontend — Usar denormalização na inbox

Atualizar `conversationService.ts` → `fetchConversations()`:
- Remover a batch query em `chat_messages` para buscar preview
- Usar diretamente `last_message_content`, `last_message_type`, `last_message_direction` da conversa

### 7. Documentação

Criar `docs/MULTICHANNEL_PHASE3_CANONICAL_CORE.md`

---

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| Migration SQL (1) | Colunas multiprovider em conversations + chat_messages |
| Migration SQL (2) | UNIQUE constraints + limpeza de duplicatas |
| Migration SQL (3) | Trigger denormalização última mensagem |
| Migration SQL (4) | Popular dados existentes |
| `src/services/conversationService.ts` | Remover batch query de preview, usar colunas denormalizadas |
| `docs/MULTICHANNEL_PHASE3_CANONICAL_CORE.md` | Documentação |

## Sem alteração em

- `whatsapp-webhook/index.ts` — será refatorado na Fase 4 (RPC de ingestão)
- `gupshup-webhook/index.ts` — idem
- `send-bulk-whatsapp/index.ts` — idem
- Frontend de chat (WhatsAppChatLayout) — nenhuma alteração

## Riscos

| Risco | Mitigação |
|---|---|
| Conversas duplicadas impedem UNIQUE constraint | Query para identificar e limpar antes de criar constraint |
| Trigger de denormalização pode impactar volume | Trigger simples (UPDATE de 3 colunas), custo mínimo |
| Colunas novas nullable para não quebrar inserts existentes | Todos os novos campos são nullable ou têm defaults |

## Resultado

- Modelo canônico de conversa e mensagem pronto para qualquer provider/canal
- Idempotência real via constraints (fim das race conditions)
- Inbox 2x mais rápida (sem query extra para preview)
- Zero breaking changes na operação atual

