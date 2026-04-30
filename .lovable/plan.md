## Fase 7 — Correções residuais do Analytics (cirúrgicas, sem afetar produção)

Escopo restrito a 3 problemas identificados no audit, sem tocar em Receita, Dashboard, Financeiro, Acordos, Baixas, WhatsApp, Discador, Funil, Score, Operadores, ou qualquer fluxo funcional. Cada fase é independente — se uma der problema, dá pra reverter sem afetar as outras.

---

### Fase 7.1 (P0) — Guard de tenant tolerante a Super Admin global

**Problema**
As 3 RPCs alteradas em `20260430163427` (`get_bi_channel_performance`, `get_bi_breakage_analysis`, `get_bi_breakage_by_operator`) usam o guard:

```sql
IF NOT public.is_super_admin(auth.uid())
   AND NOT EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.tenant_id = _tenant_id AND tu.user_id = auth.uid())
THEN RAISE EXCEPTION 'forbidden tenant'; END IF;
```

`is_super_admin` só retorna true se houver linha com role `super_admin` em `tenant_users`. Para Super Admins de plataforma cuja role só está mapeada via `profiles.role='super_admin'` (ou via `is_owner`/SA permissions), a checagem falha → "forbidden tenant".

**Correção**
Recriar as 3 RPCs aceitando também Super Admin via `profiles.role`:

```sql
-- Helper inline no guard (sem nova função)
IF NOT (
     public.is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p
             WHERE p.user_id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM public.tenant_users tu
             WHERE tu.tenant_id = _tenant_id AND tu.user_id = auth.uid())
)
THEN RAISE EXCEPTION 'forbidden tenant'; END IF;
```

Lógica de negócio das RPCs (allowlist de canais, normalização, filtro por updated_at em quebras) **permanece idêntica** — só o bloco `IF NOT (...)` muda.

**Migration nova** (não destrutiva — `CREATE OR REPLACE FUNCTION` mantém grants e assinatura):
- `supabase/migrations/<ts>_bi_guard_super_admin_fallback.sql`

**Arquivos**: 1 migration. Nenhum frontend.

**Validação**:
- Super Admin consegue abrir Analytics sem `forbidden tenant`.
- Operador comum continua restrito (regra `_operator_ids` no front + RLS).
- Admin de tenant continua passando (já estava em `tenant_users`).

---

### Fase 7.2 (P1) — Outliers no tempo de resposta WhatsApp

**Problema**
`get_bi_response_time_by_channel` calcula tempo médio de resposta usando `chat_messages.created_at` sem clipping. Conversas com gaps de 2-3 dias (cliente respondeu depois do fim de semana) elevam a média para 12h+, distorcendo a aba Canais.

**Correção**
Recriar a RPC mantendo a estrutura, adicionando filtro `interval <= '4 hours'` no cálculo do gap inbound→outbound (gaps maiores são considerados "fora de janela operacional" e descartados — não somados nem contados).

```sql
-- pseudo
WHERE response_gap_seconds BETWEEN 0 AND 14400  -- 4h
```

Não muda payload, não muda assinatura, não muda nome.

**Migration nova**:
- `supabase/migrations/<ts>_bi_response_time_clip_outliers.sql`

**Validação**: tempo médio cai para faixa realista (segundos a minutos). Aba Canais → "Tempo de Resposta" passa a ser interpretável.

---

### Fase 7.3 (P1) — Limite de credores no filtro

**Problema**
`AnalyticsFiltersBar.tsx` linha 53: `.limit(1000)` no lookup de credores distintos. Para tenants grandes, a lista é truncada e credores reais ficam fora do filtro.

**Correção**
Trocar a query atual (que faz `select('credor')` e dedup no JS) por uma RPC `SECURITY DEFINER` simples que retorna `DISTINCT credor` direto do servidor, sem o limite implícito de 1000 do PostgREST:

```sql
CREATE OR REPLACE FUNCTION public.get_distinct_credores(_tenant_id uuid)
RETURNS TABLE(credor text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT credor FROM public.clients
  WHERE tenant_id = _tenant_id AND credor IS NOT NULL
  ORDER BY credor;
$$;
GRANT EXECUTE ON FUNCTION public.get_distinct_credores(uuid) TO authenticated;
```

Frontend (`AnalyticsFiltersBar.tsx`) passa a chamar `supabase.rpc('get_distinct_credores', { _tenant_id })` em vez de `.from('clients').select('credor').limit(1000)`.

**Arquivos**:
- 1 migration nova: `<ts>_bi_distinct_credores_rpc.sql`
- `src/components/analytics/AnalyticsFiltersBar.tsx` (apenas o `useQuery` do credor, ~8 linhas)

**Validação**: lista de credores no filtro mostra todos os credores reais do tenant.

---

### Ordem de execução e segurança

Cada fase é uma migration `CREATE OR REPLACE` — idempotente e reversível por reaplicação da versão anterior. Nenhuma `DROP`, nenhuma alteração de schema, nenhum DML.

```text
7.1 (guard)  →  valida com Super Admin   →  ok?
                          ↓
7.2 (outliers tempo)  →  valida aba Canais  →  ok?
                          ↓
7.3 (credores RPC)  →  valida filtro  →  fim
```

**Não tocar nesta fase**:
- Receita (RPCs e tab) — comprovadamente correto (R$ 97.448 = Dashboard).
- Score / Funil / Operadores / Quality (sem alteração de código nem RPC).
- Dashboard, Financeiro, Acordos, Baixas, WhatsApp, Discador, Super Admin.
- `is_super_admin` / `is_tenant_admin` (não mexer — usado em todo o app).
- RLS de `clients`, `agreements`, `client_events`.

---

### Arquivos alterados (resumo)

**Migrations novas (3, todas `CREATE OR REPLACE`)**:
1. `<ts>_bi_guard_super_admin_fallback.sql` — recria as 3 RPCs com guard tolerante.
2. `<ts>_bi_response_time_clip_outliers.sql` — recria `get_bi_response_time_by_channel` com clip de 4h.
3. `<ts>_bi_distinct_credores_rpc.sql` — cria `get_distinct_credores`.

**Frontend (1 arquivo, ~8 linhas)**:
- `src/components/analytics/AnalyticsFiltersBar.tsx` — troca query de credores por RPC.

---

### Riscos residuais

- Clip de 4h em tempo de resposta é uma decisão de produto. Se o cliente quiser janela diferente (2h, 8h), basta uma migration trocando o intervalo. Documentado no comentário SQL.
- O guard Fase 7.1 passa a aceitar Super Admin via `profiles.role` — isso é coerente com `useSAPermissions` e `useTenant`, que já tratam essa role como super admin global.
- `get_distinct_credores` retorna todos os credores do tenant sem paginação. Para tenants com >50k credores distintos isto pode pesar — improvável no cenário atual, mas pode-se adicionar `LIMIT 5000` defensivo se preferir.