

# Estabilização e Escalabilidade Multi-Tenant — Status e Plano

## Diagnóstico por Item

### 1. Layout Routes (AppLayout + Outlet) — JÁ IMPLEMENTADO ✓
O `App.tsx` já usa layout routes com `<Outlet />`. O `AppLayout` é montado uma única vez como wrapper das rotas autenticadas (linha 106 do App.tsx). Nenhuma ação necessária.

### 2. Webhook Gupshup — PRECISA CORREÇÃO
O loop `for` nas linhas 78-87 de `gupshup-webhook/index.ts` itera sobre **todos os tenants** para encontrar o número de origem. Com muitos tenants, isso degrada performance.

**Correção:** Substituir o loop por uma query direta usando filtro JSONB:
```sql
SELECT id FROM tenants
WHERE settings->>'gupshup_source_number' LIKE '%' || cleaned_destination
LIMIT 1
```
Isso resolve o tenant em O(1) em vez de O(n).

### 3. Gamificação (Métricas + Filtros + Persistência) — JÁ IMPLEMENTADO ✓
Todas as correções solicitadas já foram aplicadas em iterações anteriores:
- `maior_valor_promessas` → soma de `proposed_total` de acordos pending/approved
- `menor_valor_quebra` → valor financeiro de `proposed_total` de acordos cancelled (invertido para ranking)
- `menor_taxa_quebra` → retorna 100 (performance perfeita) quando não há acordos
- Filtro por credores via `campaign_credores` → `getCampaignCredorNames()` implementado
- Persistência via `upsertOperatorPoints` → chamado em cada trigger

### 4. Consistência Multi-Tenant — PARCIALMENTE IMPLEMENTADO

**4a. `useTenant` multi-tenant** — O hook atual assume um tenant por usuário (via `get_my_tenant_id()`). Para suportar múltiplos tenants, precisaríamos de um seletor de tenant — mas isso é uma mudança de produto significativa. Por ora, o sistema funciona corretamente para o modelo atual (1 tenant por usuário).

**4b. `auto-status-sync` na CarteiraPage** — PRECISA CORREÇÃO. O `auto-status-sync` é chamado no mount da CarteiraPage (linha 314), causando uma chamada HTTP pesada toda vez que o usuário abre a carteira. O `maxlist-import` já chama `auto-status-sync` automaticamente ao final da importação (linha 629). A chamada no mount é redundante e deve ser removida.

---

## Plano de Implementação

### Arquivo 1: `supabase/functions/gupshup-webhook/index.ts`
- Remover o loop `for` (linhas 73-87)
- Substituir por query direta: buscar tenant onde `settings->>'gupshup_source_number'` corresponde ao `destination` da mensagem
- Manter o fallback por `whatsapp_instances` (já existe)

### Arquivo 2: `src/pages/CarteiraPage.tsx`
- Remover o `useEffect` que chama `auto-status-sync` no mount (linhas 311-325)
- Remover o `syncCalledRef`
- A sincronização continua ocorrendo automaticamente após importações (MaxList e ClientsPage)

### Resultado
- **Webhook**: Resolução de tenant em tempo constante, pronto para centenas de tenants
- **Carteira**: Carregamento mais rápido sem chamada HTTP desnecessária no mount
- **Gamificação**: Já estável (confirmado)
- **Layout**: Já otimizado (confirmado)

