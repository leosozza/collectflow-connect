## Diagnóstico — por que o Dashboard aparece zerado

Reproduzi direto no banco. **A causa não é fallback nem propagação** — é um bug introduzido pela última migration de "Quebra 2 estágios" na função `get_dashboard_stats`.

### Erro real

Ao chamar `SELECT * FROM get_dashboard_stats(NULL, 2026, 5);` o Postgres retorna:

```text
ERROR: 42703: column ag.cpf_cnpj does not exist
CONTEXT: PL/pgSQL function get_dashboard_stats(uuid,integer,integer,uuid[])
```

A coluna real em `public.agreements` é **`client_cpf`** — confirmado via `information_schema`. O bloco final de `_acionados_ontem` ficou:

```sql
AND NOT EXISTS (
  SELECT 1 FROM agreements ag
  WHERE ag.tenant_id = _tenant
    AND ag.cpf_cnpj = vc.cpf       -- ❌ coluna inexistente
    AND ag.created_at::date >= CURRENT_DATE - 1
)
```

Como esse bloco roda **antes** do `RETURN QUERY`, a função inteira aborta. Toda métrica volta vazia, o React Query lança, e os cards renderizam `0`. Os warnings de `_v2 not found` no console são esperados (você está rodando com fallback) — eles não são o problema; o problema é que o legacy também está quebrado.

### Estado dos dados no tenant `39a450f8…`

- 596 acordos no histórico, 1 em maio/2026, 65 completos, 5 approved, 452 pending.
- Há dados — a RPC simplesmente não chega a retornar nada por causa do erro SQL.

---

## Correção

### 1. Migration: corrigir `get_dashboard_stats` com comparação normalizada de CPF

`CREATE OR REPLACE FUNCTION` mantendo todo o resto idêntico (Quebra 2 estágios, recebido, pendente, projetado, contagens) e ajustando só o bloco quebrado.

Como você pediu **comparação normalizada de CPF**, vou aplicar `regexp_replace(...,'\D','','g')` nos dois lados — assim acordos com CPF formatado (`123.456.789-09`) também batem com CPFs extraídos do `page_path` (que já vêm só dígitos):

```sql
WITH visited_cpfs AS (
  SELECT DISTINCT regexp_replace(
           COALESCE(NULLIF(split_part(ual.page_path,'/',3),''),''),
           '\D','','g'
         ) AS cpf
  FROM public.user_activity_logs ual
  WHERE ual.tenant_id = _tenant
    AND ual.created_at >= date_trunc('day', now() - interval '1 day')
    AND ual.created_at <  date_trunc('day', now())
    AND (_no_op_filter OR ual.user_id = _user_id
         OR ual.user_id = ANY(COALESCE(_user_ids,'{}'::uuid[])))
)
SELECT COUNT(DISTINCT vc.cpf) INTO _acionados_ontem
FROM visited_cpfs vc
WHERE vc.cpf <> ''
  AND NOT EXISTS (
    SELECT 1 FROM agreements ag
    WHERE ag.tenant_id = _tenant
      AND regexp_replace(COALESCE(ag.client_cpf,''),'\D','','g') = vc.cpf
      AND ag.created_at::date >= CURRENT_DATE - 1
  );
```

### 2. Validação imediata

Após aplicar a migration, executar exatamente o comando que você pediu:

```sql
SELECT * FROM get_dashboard_stats(NULL, 2026, 5);
```

Esperado: linhas com `total_pendente`, `total_quebra`, `total_recebido` > 0 (dado o histórico do tenant). Se vierem números coerentes, o Dashboard sai do zero automaticamente — sem precisar mexer em frontend nem fallback.

### 3. Endurecer log do fallback (defensivo, opcional mas recomendado)

Hoje o fallback do frontend converte erros em `console.warn` discretos que escondem erros SQL. Vou adicionar `console.error` no catch do legacy para que, na próxima vez que algo quebrar no banco, a gente veja o erro real no console em vez de só o warning de `_v2 not found`:

- `src/pages/DashboardPage.tsx` — catch de `callDashboardStats` e `callDashboardVencimentos`.
- `src/components/dashboard/TotalRecebidoCard.tsx` — catches dos blocos legacy (manual_payments, portal_payments, negociarie_cobrancas).

Sem mudança de comportamento — só visibilidade.

---

## Sobre as funções `_v2`

`get_dashboard_stats_v2`, `get_dashboard_vencimentos_v2` e `get_financial_received_by_day` continuam sem existir no schema. Os warnings vão continuar aparecendo até a fonte central ser aprovada e o fallback ser removido. **Não vou criá-las nem removê-las nesse passo** — não é o pedido. Quando você aprovar a fonte central, removemos o fallback junto.

---

## Arquivos

**Backend**
- `supabase/migrations/<ts>_fix_dashboard_stats_cpf_normalized.sql` — `CREATE OR REPLACE FUNCTION public.get_dashboard_stats` com `ag.cpf_cnpj` → `regexp_replace(ag.client_cpf,'\D','','g')`.

**Frontend (defensivo)**
- `src/pages/DashboardPage.tsx`
- `src/components/dashboard/TotalRecebidoCard.tsx`

Sem mudança em UI, props ou assinaturas de RPC.
