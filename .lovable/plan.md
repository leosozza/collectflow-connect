

# FASE 4 — RPC Transacional de Ingestão Canônica

## Objetivo

Centralizar toda a lógica de ingestão de mensagens (resolve cliente, resolve/cria conversa, deduplica, grava mensagem, atualiza resumo, aplica SLA, atribui operador) em uma **única função PostgreSQL transacional** (`ingest_channel_event`). Os webhooks passam a ser apenas parsers de payload que chamam essa RPC.

## Situação Atual

A lógica de ingestão está **espalhada em 3 locais**:

| Local | Lógica |
|---|---|
| `whatsapp-webhook/index.ts` (385 linhas) | findClientByPhone + getSlaMinutes + assignRoundRobin + resolve/create conversation + dedup + insert message — **tudo em TypeScript** |
| `gupshup-webhook/index.ts` (64 linhas) | Só atualiza `message_logs` — **não cria conversas nem chat_messages** |
| `send-bulk-whatsapp/index.ts` | `ensureConversationAndMessage()` — outra implementação paralela de resolve/create conversation |

Problemas:
- 3 implementações diferentes da mesma lógica
- Sem transacionalidade (queries separadas = race conditions)
- `findClientByPhone` usa `ILIKE %suffix%` em `clients` (ignora `client_phones` da Fase 2)
- Gupshup inbound é completamente invisível na inbox
- Adicionar novo provider exige duplicar toda a lógica

## O Que Será Feito

### 1. Migration — Criar RPC `ingest_channel_event`

Função PostgreSQL `SECURITY DEFINER` que recebe um payload canônico e executa tudo em uma transação:

```text
ingest_channel_event(
  _tenant_id uuid,
  _endpoint_id uuid,
  _channel_type text,        -- 'whatsapp', 'voice', etc.
  _provider text,             -- 'evolution', 'gupshup', 'wuzapi', 'meta'
  _remote_phone text,
  _remote_name text,
  _direction text,            -- 'inbound' | 'outbound'
  _message_type text,         -- 'text', 'image', 'audio', etc.
  _content text,
  _media_url text,
  _media_mime_type text,
  _external_id text,
  _provider_message_id text,
  _actor_type text,           -- 'human', 'ai', 'system', 'campaign'
  _status text                -- 'sent', 'delivered', etc.
)
RETURNS jsonb  -- { conversation_id, message_id, is_new_conversation, client_id, skipped_duplicate }
```

Lógica interna (em ordem):
1. **Resolver cliente** — chama `resolve_client_by_phone` (Fase 2)
2. **Resolver conversa** — busca por `(tenant_id, endpoint_id, remote_phone)` ou cria nova
3. **Fluxo de status** — closed→waiting (inbound), waiting→open não muda, etc.
4. **Deduplicação** — INSERT com `ON CONFLICT (tenant_id, external_id)` DO NOTHING, retorna `skipped_duplicate = true`
5. **Gravar mensagem** — INSERT em `chat_messages` com provider, endpoint_id, actor_type
6. **Atualizar resumo** — `last_message_content/type/direction/at`, `unread_count`
7. **SLA** — calcula por credor → fallback tenant
8. **Round-robin** — atribuição para novas conversas inbound (consulta `operator_instances` + count)

### 2. Refatorar `whatsapp-webhook/index.ts`

Reduzir de ~385 linhas para ~100 linhas:
- Manter parsing do payload Evolution (connection.update, messages.upsert, messages.update)
- Transformar payload Evolution → payload canônico
- Chamar `supabase.rpc('ingest_channel_event', {...})`
- Manter handler de `connection.update` como está (não é ingestão de mensagem)
- Manter handler de `messages.update` (status updates) — chamar um UPDATE simples por `external_id`
- Remover: `findClientByPhone`, `getSlaMinutes`, `assignRoundRobin`, toda a lógica de conversation management

### 3. Refatorar `gupshup-webhook/index.ts`

Transformar de "log-only" em webhook funcional:
- Parsear payload Gupshup (inbound messages + status updates)
- Para inbound: transformar em payload canônico → chamar `ingest_channel_event`
- Para status: atualizar `chat_messages.status` por `external_id`
- Manter atualização de `message_logs` existente como fallback

### 4. Refatorar `send-bulk-whatsapp/index.ts` → `ensureConversationAndMessage`

Substituir a implementação local por chamada à mesma RPC `ingest_channel_event` com `direction = 'outbound'` e `actor_type = 'campaign'`.

### 5. Documentação

Criar `docs/MULTICHANNEL_PHASE4_INGESTION_RPC.md`

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Criar RPC `ingest_channel_event` |
| `supabase/functions/whatsapp-webhook/index.ts` | Refatorar para parser + chamada RPC |
| `supabase/functions/gupshup-webhook/index.ts` | Transformar em webhook funcional com ingestão |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Substituir `ensureConversationAndMessage` por chamada RPC |
| `docs/MULTICHANNEL_PHASE4_INGESTION_RPC.md` | Documentação |

## Sem alteração em

- Frontend — nenhuma alteração
- `conversationService.ts` — envio manual será refatorado na Fase 5
- `_shared/whatsapp-sender.ts` — motor de envio permanece (Fase 5 unifica)

## Riscos

| Risco | Mitigação |
|---|---|
| RPC complexa pode falhar silenciosamente | Retorno jsonb detalhado com status de cada etapa |
| Round-robin dentro do PostgreSQL | Usa mesma lógica atual (count conversations por operador) — funcional até Fase 9 |
| Gupshup inbound nunca foi testado com conversas | Começar com logs detalhados, mesma estrutura validada do Evolution |
| `send-bulk-whatsapp` muda de INSERT direto para RPC | A RPC faz exatamente o mesmo, com idempotência melhor |

## Resultado

- **Uma única fonte de verdade** para ingestão de mensagens
- Webhooks viram apenas **parsers de payload** (~100 linhas cada)
- Gupshup inbound **funcional** na inbox
- Campanhas usam o **mesmo pipeline**
- Adicionar novo provider = apenas criar novo parser de payload
- Transacionalidade real (sem race conditions)

