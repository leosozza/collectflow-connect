

# Plano: Correções Críticas de Produção — Isolamento, Performance e Estabilidade

## Resumo

Aplicar hardening multi-tenant, corrigir a edge function `auto-status-sync`, otimizar queries pesadas, criar índices de performance e normalizar CPF/telefone na importação. Sem alterar UI, sem criar telas, sem mudar fluxos de negócio.

---

## Bloco 1: Edge Function `auto-status-sync` — Isolamento por Tenant

**Problema**: A função opera globalmente — todas queries rodam sem filtro de `tenant_id`, afetando dados de todos os tenants simultaneamente.

**Correção em `supabase/functions/auto-status-sync/index.ts`**:
- Receber `tenant_id` no body da requisição (obrigatório)
- Rejeitar com 400 se `tenant_id` não informado
- Filtrar `tipos_status` por `tenant_id`
- Adicionar `.eq("tenant_id", tenant_id)` em TODAS as queries de `clients` (são ~12 queries)
- Retornar `tenant_id` e contagens no response como log

---

## Bloco 2: Isolamento nos Services do Frontend

**Problema**: `fetchClients` em `clientService.ts` faz `select("*")` sem filtro de `tenant_id` — depende apenas de RLS. Se RLS falhar ou for permissiva, dados de outros tenants podem vazar. Mesmo padrão em `agreementService.ts`.

**Correção**:

### `clientService.ts` — `fetchClients`
- Receber `tenantId` como parâmetro obrigatório
- Adicionar `.eq("tenant_id", tenantId)` na query
- Trocar `select("*")` por colunas específicas: `id, nome_completo, cpf, phone, email, credor, status, data_vencimento, valor_parcela, valor_pago, numero_parcela, total_parcelas, propensity_score, tipo_devedor_id, tipo_divida_id, status_cobranca_id, operator_id, external_id, created_at, valor_saldo, phone2, phone3, endereco, cidade, uf, cep, observacoes, debtor_profile, data_quitacao, tenant_id`

### `clientService.ts` — `bulkCreateClients`
- Na busca de existentes (`select("*").in("external_id", ...)`), adicionar `.eq("tenant_id", tenantId)` — o tenantId já vem do operador

### `clientService.ts` — `removeFutureInstallments`
- Precisa de `tenant_id` para não deletar parcelas de outro tenant com mesmo CPF/credor

### `agreementService.ts` — `fetchAgreements`
- Receber `tenantId` como parâmetro obrigatório
- Adicionar `.eq("tenant_id", tenantId)`

### `CarteiraPage.tsx` — queries auxiliares
- `agreement-cpfs`: adicionar `.eq("tenant_id", tenant.id)`
- `contacted-client-ids` (call_dispositions): adicionar `.eq("tenant_id", tenant.id)`
- `contacted-client-ids` (conversations): adicionar `.eq("tenant_id", tenant.id)`

### Propagar `tenantId` nos callers
- `CarteiraPage`, `AcordosPage`, `ClientsPage` — passar `tenant.id` nos services

---

## Bloco 3: Eliminar `fetchAllRows` em Queries Pesadas

**Problema**: `fetchClients` usa `fetchAllRows` que pagina em batches de 1000 e carrega TUDO em memória. Com 50k+ registros, isso trava o browser.

**Correção**:

### `clientService.ts` — `fetchClients`
- Remover `fetchAllRows`, usar paginação server-side com `.range(from, to)`
- Alterar assinatura para aceitar `page` e `pageSize` (default 50)
- Retornar `{ data: Client[], count: number }` usando `.select("...", { count: "exact" })`

### `CarteiraPage.tsx`
- Adaptar para usar paginação server-side (já tem controle de página no URL state)
- Atualizar queryKey para incluir `page`

### `agreementService.ts` — `fetchAgreements`
- Substituir `fetchAllRows` por `.range()` com paginação
- Retornar `{ data, count }`

### `CarteiraPage.tsx` — queries auxiliares
- `agreement-cpfs`: manter `fetchAllRows` mas selecionar apenas `client_cpf` (já faz)
- `contacted-client-ids`: manter mas limitar a tenant

---

## Bloco 4: Criar Índices de Performance (Migration SQL)

```sql
-- clients
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON clients(cpf);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_data_vencimento ON clients(tenant_id, data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_clients_external_id ON clients(tenant_id, external_id);
CREATE INDEX IF NOT EXISTS idx_clients_credor ON clients(tenant_id, credor);

-- conversations
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_last_msg ON conversations(tenant_id, last_message_at DESC);

-- chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);

-- call_dispositions
CREATE INDEX IF NOT EXISTS idx_call_dispositions_client ON call_dispositions(client_id);
CREATE INDEX IF NOT EXISTS idx_call_dispositions_tenant ON call_dispositions(tenant_id);

-- agreements
CREATE INDEX IF NOT EXISTS idx_agreements_client_cpf ON agreements(tenant_id, client_cpf);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON agreements(tenant_id, status);

-- client_events
CREATE INDEX IF NOT EXISTS idx_client_events_client ON client_events(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_events_tenant ON client_events(tenant_id, event_type);
```

---

## Bloco 5: Normalização de CPF e Telefone na Importação

**Estado atual**: `importService.ts` já tem `cleanCPF()` e `cleanPhone()` que normalizam. `bulkCreateClients` em `clientService.ts` usa dados pós-parse que já passaram por essas funções.

**Problema residual**: Na MaxList (`MaxListPage.tsx`), o CPF é limpo (`replace(/[^\d]/g, "")`) mas a função `cleanCPF` do `cpfUtils` faz `padStart(11, "0")` que a MaxList não aplica.

**Correção**:
- Em `MaxListPage.tsx`, no `buildRecordFromMapping`, usar `cleanCPF()` de `@/lib/cpfUtils` para o CPF
- Em `MaxListPage.tsx`, garantir que telefones passam por `cleanPhone` (já faz `replace(/[^\d]/g, "")`)
- Em `clientService.ts` — `bulkCreateClients`, aplicar `cleanCPF` como sanitização final antes do insert/upsert

---

## Bloco 6: MaxList — NÃO migrar para backend nesta fase

A migração da importação MaxList para edge function é uma refatoração significativa que envolve:
- Criar nova edge function com lógica de mapeamento complexa
- Implementar sistema de jobs assíncronos
- Criar polling de progresso

**Recomendação**: Adiar para fase 2. Nesta fase, manter processamento no frontend mas:
- Garantir isolamento por tenant (já tem)
- Usar batches menores (já usa 1000)
- Adicionar `tenant_id` explícito em todas as operações

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/auto-status-sync/index.ts` | tenant_id obrigatório + filtrar todas queries |
| `src/services/clientService.ts` | tenant_id explícito + paginação server-side + select colunas + normalização CPF |
| `src/services/agreementService.ts` | tenant_id explícito + paginação |
| `src/pages/CarteiraPage.tsx` | adaptar para paginação server-side + tenant_id nas queries |
| `src/pages/AcordosPage.tsx` | passar tenant_id |
| `src/pages/MaxListPage.tsx` | usar cleanCPF de cpfUtils |
| Migration SQL | índices de performance |

## O que NÃO muda
- Layout, telas, componentes visuais — intactos
- Fluxos de negócio — intactos
- Contact Center, chat, automação — intactos
- Estrutura de tabelas — intacta (apenas índices)
- Edge functions não mencionadas — intactas

