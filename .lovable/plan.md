

# Otimização de Alta Escala — WhatsApp System

## Visão Geral

Quatro pilares de otimização: busca de clientes no banco, paginação server-side no chat, consolidação do webhook, e chunked processing em campanhas.

---

## Pilar 1 — Busca de Clientes Indexada

**Problema**: `useClientByPhone.ts` usa `ILIKE %suffix%` — full table scan.

**Solução**: Já existe a infraestrutura da Fase 2 (`client_phones` com `phone_last8` indexado + RPC `resolve_client_by_phone`). Falta migrar o frontend para usá-la.

**Mudanças**:
- **`src/hooks/useClientByPhone.ts`**: Substituir query ILIKE por chamada `supabase.rpc("resolve_client_by_phone", { _tenant_id, _phone })`. Resultado volta indexado via `idx_client_phones_tenant_last8`.
- **Migração SQL**: Criar índice `idx_client_phones_tenant_last8` caso não exista (verificar). Adicionar índice GIN com `pg_trgm` em `clients.nome_completo` para buscas por nome no futuro.

---

## Pilar 2 — Paginação Server-Side + Filtros no Banco

**Problema**: `fetchConversations` carrega tudo na memória; filtros de status/operador/instância são `.filter()` no JS.

**Mudanças**:

### `src/services/conversationService.ts`
- Expandir `fetchConversations` para aceitar todos os filtros: `statusFilter`, `instanceFilter`, `operatorFilter`, `search`, `unreadOnly`, `linkFilter`.
- Aplicar filtros via `.eq()` / `.ilike()` / `.gt()` no Supabase query (server-side).

### `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`
- Usar `useInfiniteQuery` do TanStack Query em vez de `useState` + `loadConversations`.
- Carregar páginas de 30 conversas por vez, com `getNextPageParam` baseado no count retornado.
- Passar filtros como dependências do queryKey para refetch automático.
- Manter realtime subscription para updates incrementais (já otimizado).

### `src/components/contact-center/whatsapp/ConversationList.tsx`
- Remover toda lógica de filtragem JS (`filtered = conversations.filter(...)`).
- Receber conversas já filtradas do parent.
- Adicionar `onLoadMore` callback + `IntersectionObserver` no final da lista para scroll infinito.
- Status counts virão de uma query separada (ou do `count` do fetch).

---

## Pilar 3 — Webhook Consolidado (RPC Única)

**Problema**: O webhook faz 3+ queries sequenciais (buscar instância, resolver cliente, buscar SLA, inserir mensagem).

**Situação atual**: O `ingest_channel_event` RPC **já consolida** resolve cliente + find/create conversa + deduplica + insere mensagem + SLA. O webhook já a utiliza.

**Otimização restante**:
- **Lookup de instância**: Mover a busca de `whatsapp_instances` para dentro da RPC, recebendo `_instance_name` em vez de `_endpoint_id`. Isso elimina 1 query no webhook.
- Criar **nova versão** da RPC `ingest_channel_event_v2` que aceita `_instance_name` e faz o lookup internamente.
- Atualizar `whatsapp-webhook/index.ts` e `gupshup-webhook/index.ts` para usar a v2.

**Mudanças**:
- **Migração SQL**: Criar `ingest_channel_event_v2` com parâmetro `_instance_name text` que resolve internamente `whatsapp_instances` → `endpoint_id` + `tenant_id`.
- **`whatsapp-webhook/index.ts`**: Simplificar para ~60 linhas — parse payload + chama RPC v2 com `_instance_name`.
- **`gupshup-webhook/index.ts`**: Mesma simplificação.

---

## Pilar 4 — Campanhas com Chunked Processing

**Problema**: `send-bulk-whatsapp` carrega todos os recipients `pending` de uma vez. Campanhas grandes podem estourar memória/timeout.

**Mudanças em `supabase/functions/send-bulk-whatsapp/index.ts`**:
- Processar recipients em **chunks de 100** (carregar 100 pending, processar, carregar próximos 100).
- Adicionar **contagem prévia** de recipients pendentes para estimar tempo.
- Implementar **checkpoint**: atualizar `whatsapp_campaigns.progress_metadata` com `{ processed: N, last_recipient_id }` a cada chunk.
- Se a função atingir ~50s de execução, retornar `{ status: "partial", processed, remaining }` — o frontend pode re-invocar automaticamente.
- Manter throttle de 200ms entre mensagens (já existe).

---

## Resumo de Arquivos

| Arquivo | Mudança |
|---|---|
| Migração SQL | `ingest_channel_event_v2` + índice GIN em `nome_completo` |
| `src/hooks/useClientByPhone.ts` | Migrar para RPC `resolve_client_by_phone` |
| `src/services/conversationService.ts` | Filtros server-side em `fetchConversations` |
| `WhatsAppChatLayout.tsx` | `useInfiniteQuery` + filtros como queryKey |
| `ConversationList.tsx` | Remover `.filter()` JS + scroll infinito |
| `whatsapp-webhook/index.ts` | Simplificar com RPC v2 (instance lookup interno) |
| `gupshup-webhook/index.ts` | Mesma simplificação |
| `send-bulk-whatsapp/index.ts` | Chunked processing + checkpoint |

## Segurança

- Multi-tenancy (`tenant_id`) preservada em todas as queries e RPCs
- Compatibilidade Evolution/Gupshup/WuzAPI mantida
- Zero breaking changes — RPC v1 permanece funcional

