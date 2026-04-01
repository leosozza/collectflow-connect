

# Plano: Fase 2 — Performance, Escalabilidade e Estabilidade

## Resumo

Otimizar os módulos mais críticos (Carteira, WhatsApp, Telefonia) para operar com volume real. Mover lógica pesada para o banco, implementar paginação real, polling adaptativo e estruturar observações. Sem alterar UI, sem criar telas, sem mudar lógica de negócio.

---

## Bloco 1: Carteira — RPC de Agrupamento no Banco

**Problema**: O frontend busca até 1000 registros brutos, depois agrupa por CPF, calcula totais, deriva status e filtra — tudo em `useMemo` com ~160 linhas de lógica. Com 50k+ registros, isso é insustentável.

### 1.1 — Criar RPC `get_carteira_grouped`

Criar uma function SQL que retorna dados já agrupados:

```sql
CREATE FUNCTION get_carteira_grouped(
  _tenant_id uuid,
  _page int DEFAULT 1,
  _page_size int DEFAULT 50,
  _search text DEFAULT NULL,
  _credor text DEFAULT NULL,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _status_cobranca_ids uuid[] DEFAULT NULL,
  _tipo_devedor_ids uuid[] DEFAULT NULL,
  _tipo_divida_ids uuid[] DEFAULT NULL,
  _score_min int DEFAULT NULL,
  _score_max int DEFAULT NULL,
  _debtor_profiles text[] DEFAULT NULL,
  _sort_field text DEFAULT 'created_at',
  _sort_dir text DEFAULT 'desc',
  _operator_id uuid DEFAULT NULL,
  _sem_acordo boolean DEFAULT false
) RETURNS TABLE (
  representative_id uuid,
  cpf text,
  nome_completo text,
  credor text,
  phone text,
  email text,
  data_vencimento date,
  valor_total numeric,
  parcelas_count int,
  propensity_score int,
  status_cobranca_id uuid,
  status text,
  debtor_profile text,
  all_ids uuid[],
  total_count bigint
)
```

Lógica interna:
- `GROUP BY cpf` com agregações (SUM valor_parcela, COUNT, MAX score, MIN data_vencimento)
- Derivação de `status_cobranca_id` representativo via CASE WHEN (mesma lógica que hoje está no frontend)
- Filtros aplicados via WHERE dinâmico
- `_sem_acordo`: LEFT JOIN com agreements para excluir CPFs com acordo ativo
- Paginação via `OFFSET/LIMIT`
- Retorna `total_count` usando `COUNT(*) OVER()`

### 1.2 — Adaptar `clientService.ts`

Nova função `fetchCarteiraGrouped(tenantId, filters, page, pageSize)`:
- Chama `supabase.rpc("get_carteira_grouped", params)`
- Retorna `{ data: GroupedClient[], count: number }`

### 1.3 — Adaptar `CarteiraPage.tsx`

- Substituir `fetchClients` + `useMemo displayClients` (~160 linhas) por `fetchCarteiraGrouped`
- Remover agrupamento por CPF no frontend
- Remover derivação de status no frontend
- Manter: seleção em massa, exportação, dialogs, view mode, kanban
- Paginação real com controles next/prev + total
- queryKey inclui page + todos os filtros

### 1.4 — Adaptar `CarteiraKanban`

- Receber dados já agrupados (mesmo formato)
- Manter paginação interna por coluna (já existe)

### 1.5 — Manter queries auxiliares

- `agreement-cpfs`: manter (usado para badge "Acordo Vigente" e filtro semAcordo — agora o filtro vai para a RPC, mas o badge visual pode precisar)
- `contacted-client-ids`: remover do frontend se possível (mover para RPC se necessário)

---

## Bloco 2: WhatsApp — Paginação e Realtime Otimizado

**Problema**: `loadConversations()` busca TODAS as conversas do tenant sem paginação. O realtime chama `loadConversations()` a cada evento, recarregando tudo.

### 2.1 — Paginar conversas em `conversationService.ts`

```typescript
export async function fetchConversations(
  tenantId: string,
  page = 1,
  pageSize = 50,
  statusFilter?: string
): Promise<{ data: Conversation[], count: number }> {
  // .range() + count: "exact"
}
```

### 2.2 — Paginar mensagens

```typescript
export async function fetchMessages(
  conversationId: string,
  page = 1,
  pageSize = 100
): Promise<{ data: ChatMessage[], hasMore: boolean }> {
  // Ordered DESC, then reverse for display
  // Implements infinite scroll upward
}
```

### 2.3 — Realtime otimizado em `WhatsAppChatLayout.tsx`

Substituir `loadConversations()` no handler de realtime por atualização pontual:

```typescript
// Em vez de recarregar tudo:
if (payload.eventType === "INSERT") {
  setConversations(prev => [newConv, ...prev]);
} else if (payload.eventType === "UPDATE") {
  setConversations(prev => prev.map(c => c.id === updated.id ? {...c, ...updated} : c));
}
```

### 2.4 — Mensagens realtime (já funciona bem)

O handler de mensagens já faz append incremental — manter como está.

### 2.5 — Infinite scroll na ConversationList

- Detectar scroll no final da lista
- Carregar próxima página
- Concatenar com conversas existentes

---

## Bloco 3: Telefonia — Polling Adaptativo

**Problema**: `fetchAll` roda a cada 3s (operador) ou 30s (admin), independente do estado. Com múltiplos operadores, isso gera muitas chamadas simultâneas ao proxy.

### 3.1 — Polling adaptativo baseado em estado

No `TelefoniaDashboard.tsx`:

```typescript
const getAdaptiveInterval = useCallback(() => {
  if (!myAgent || !isAgentOnline) return 30000; // offline: 30s
  const status = myAgent.status;
  if (status === 2) return 3000;  // em ligação: 3s
  if (status === 3 || status === 4) return 5000; // pausa/ACW: 5s
  if (status === 1) return 10000; // ocioso: 10s
  return 15000; // default: 15s
}, [myAgent, isAgentOnline]);
```

Para admin: manter 30s fixo (já é).

### 3.2 — Backoff em erro

```typescript
const errorCountRef = useRef(0);
const fetchAllWithBackoff = useCallback(async () => {
  try {
    await fetchAll();
    errorCountRef.current = 0;
  } catch {
    errorCountRef.current++;
  }
}, [fetchAll]);

// Interval = base * (1 + errorCount), max 60s
```

### 3.3 — Separar dados críticos de analíticos

Atualmente `fetchAll` busca agents + company_calls + campaigns em paralelo. Separar:
- **Crítico (polling rápido)**: `agents_status` (para operador, só seu status)
- **Analítico (polling lento)**: `company_calls`, `list_campaigns`, `campaign_statistics`

Para operadores: buscar apenas `agents_status` + suas campanhas no polling rápido. Campanhas e stats em polling separado de 60s.

---

## Bloco 4: Observações Estruturadas

**Estado atual**: Observações já são salvas em DUAS fontes:
1. `clients.observacoes` — string concatenada (legado)
2. `client_events` com `event_type = "observation_added"` — estruturado (já implementado)

O ClientTimeline já lê de `client_events` quando disponível. A `ClientObservations` lê de `clients.observacoes`.

### 4.1 — Migrar `ClientObservations` para ler de `client_events`

- Em vez de parsear `clients.observacoes` (string concatenada), buscar de `client_events` com `event_type = "observation_added"`
- Manter a UI idêntica (lista de notas com data + operador)
- Dados vêm de `metadata.note` e `metadata.operator_name`

### 4.2 — Manter gravação dual

Ao salvar nota, continuar gravando em ambos (clients.observacoes + client_events) para backwards compatibility. Mas a leitura passa a vir de client_events.

### 4.3 — Truncar `clients.observacoes`

No `handleSaveNote`, limitar `clients.observacoes` às últimas 5 notas (resumo curto), não ao log completo. O histórico completo fica em client_events.

---

## Bloco 5: Normalização Centralizada de Busca

**Estado atual**: `cleanCPF` e `normalizeCPF` já existem em `cpfUtils.ts`. Telefone é limpo com `replace(/\D/g, "")` inline em vários locais.

### 5.1 — Criar `normalizePhone` em `cpfUtils.ts`

```typescript
export const normalizePhone = (value: string): string => {
  const digits = String(value || "").replace(/\D/g, "");
  // Remove country code 55 if present and length > 11
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  if (digits.length === 12 && digits.startsWith("55")) return digits.slice(2);
  return digits;
};
```

### 5.2 — Aplicar nas buscas críticas

- `useClientByPhone.ts` — usar `normalizePhone` antes da busca
- `TelefoniaAtendimentoWrapper` — normalizar CPF com `cleanCPF` antes da query
- `conversationService.ts` — normalizar phone ao buscar/vincular
- `clientService.ts` — normalizar phone no `fetchClients` search

---

## Bloco 6: Logs Operacionais Estruturados

### 6.1 — Adicionar timing ao logger

```typescript
export const logger = {
  // ... existente ...
  timed: (module: string, action: string) => {
    const start = performance.now();
    return (data?: Record<string, any>) => {
      const duration = Math.round(performance.now() - start);
      console.log(JSON.stringify({ level: "info", module, action, duration_ms: duration, ...data, ts: new Date().toISOString() }));
    };
  },
};
```

### 6.2 — Instrumentar módulos críticos

- `fetchCarteiraGrouped` — log com tenant_id, filtros, count, duração
- `fetchConversations` — log com tenant_id, count, duração
- `fetchAll` (telefonia) — log com tenant_id, agent_count, duração
- `bulkCreateClients` — log com tenant_id, batch_size, duração

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| **Migration SQL** | RPC `get_carteira_grouped` |
| `src/services/clientService.ts` | Nova função `fetchCarteiraGrouped` |
| `src/pages/CarteiraPage.tsx` | Usar RPC, remover agrupamento frontend, paginação real |
| `src/services/conversationService.ts` | Paginação em conversas e mensagens |
| `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` | Realtime otimizado, paginação |
| `src/components/contact-center/whatsapp/ConversationList.tsx` | Infinite scroll |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Polling adaptativo + backoff |
| `src/components/atendimento/ClientTimeline.tsx` | ClientObservations lê de client_events |
| `src/pages/AtendimentoPage.tsx` | Truncar observacoes no save |
| `src/lib/cpfUtils.ts` | normalizePhone |
| `src/hooks/useClientByPhone.ts` | Usar normalizePhone |
| `src/lib/logger.ts` | Método timed |

## O que NÃO muda
- Layout, design, componentes visuais — intactos
- Lógica de negócio (acordos, pagamentos, comissões) — intacta
- Edge functions não mencionadas — intactas
- Estrutura de tabelas — intacta (apenas nova RPC)
- Fluxos operacionais — preservados

## Ordem de implementação sugerida

1. RPC + Carteira (maior impacto em performance)
2. WhatsApp paginação + realtime
3. Telefonia polling adaptativo
4. Observações estruturadas
5. Normalização + Logs

