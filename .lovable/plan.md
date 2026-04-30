
## Diagnóstico — divergência de R$ 23.778,91

Auditando o tenant **Y.BRASIL** (Abril/2026):

| Fonte | Valor |
|---|---|
| `manual_payments` (status confirmed/approved, por `payment_date`) | **R$ 71.926,42** |
| `portal_payments` (status `paid`) | R$ 0,00 |
| `negociarie_cobrancas` (status `pago`, por `data_pagamento`) | **R$ 23.778,91** |
| **Total real (Dashboard)** | **R$ 95.705,33** ✓ |
| **Analytics atual** | R$ 71.926,42 ✗ |

### Causa raiz

A RPC `get_bi_revenue_summary` (e várias outras) tem **dois bugs** simultâneos:

1. **Ignora 2 fontes de pagamento**: só lê `manual_payments`, deixando de fora `portal_payments` (devedor pagando pelo portal) e `negociarie_cobrancas` (gateway Negociarie).
2. **Filtra pagamento por `agreements.created_at`** (data do acordo), em vez de `payment_date` (data do pagamento). Isso descarta pagamentos recentes de acordos antigos e inclui pagamentos antigos de acordos do período — o oposto do que o cliente espera.

O Dashboard (`TotalRecebidoCard.tsx`) já faz isso correto somando as 3 fontes por data efetiva de pagamento. O Analytics precisa seguir o mesmo padrão.

### Impacto cascata

O bug se propaga para várias abas:

| RPC | Aba | Bug |
|---|---|---|
| `get_bi_revenue_summary` | Receita (KPIs) | 2 bugs (ignora portal/negociarie + filtra por created_at) |
| `get_bi_revenue_by_period` | Receita (gráfico Evolução) | 2 bugs |
| `get_bi_revenue_by_credor` | Receita (Ranking Top 10) | 2 bugs |
| `get_bi_revenue_comparison` | Receita (vs Anterior) | herda do summary |
| `get_bi_collection_funnel` | Funil de Cobrança | só conta `manual_payments` (subestima estágio "pagamento") |
| `get_bi_funnel_dropoff` | Funil (drop-off) | mesmo bug |
| `get_bi_operator_performance` | Operadores (coluna "Recebido") | 2 bugs + atribuição limitada a `manual_payments` |
| `get_bi_channel_performance` | Canais (recebido atribuído) | 2 bugs |
| `get_bi_score_vs_result` | Score & Propensão | 2 bugs |

### Bugs adicionais encontrados (revisão completa)

1. **`get_bi_revenue_by_period`**: filtra `a.status <> 'cancelled'` na base, mas `total_negociado` não deveria excluir cancelados se a métrica é "negociado bruto" (Dashboard inclui). Tornar consistente com `summary` (que separa via FILTER).
2. **`get_bi_score_distribution`**: usa `clients` sem deduplicar por CPF/credor (a RPC `score_vs_result` deduplica corretamente — alinhar).
3. **`get_bi_top_opportunities`**: filtra clientes "sem acordo ativo", o que está correto, mas não respeita `_date_from/_date_to` para nada — é "snapshot atual" ignorando o filtro de período. Documentar via empty state ou aceitar como snapshot (manter comportamento, só clarear UI).
4. **`get_bi_operator_efficiency`** e **`get_bi_operator_performance`** ignoram `_channel` (nem chamada nem mensagem é filtrada por canal). Aceitável: chamada já é canal "voz". Manter.
5. **`get_bi_revenue_comparison`** divide por zero quando previous=0 e retorna `NULL` → o front mostra "0.0%" verde (visto no print do usuário). Tratar `NULL` no front mostrando "—" ou "Sem comparação".

---

## Mudanças

### A. Migração SQL — corrigir RPCs

Criar uma única migração que substitui as 9 RPCs afetadas. Padrão a aplicar em **todas** as RPCs que somam "recebido":

```sql
-- CTE unificada de pagamentos (substitui o CTE pagos antigo)
all_payments AS (
  -- Manual
  SELECT mp.agreement_id, mp.amount_paid::numeric AS pago, mp.payment_date::date AS pago_em
  FROM manual_payments mp
  WHERE mp.tenant_id = _tenant_id
    AND mp.status IN ('confirmed','approved')
  UNION ALL
  -- Portal
  SELECT pp.agreement_id, pp.amount::numeric, pp.updated_at::date
  FROM portal_payments pp
  WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
  UNION ALL
  -- Negociarie (vincular ao acordo via cobrancas → agreement_id se existir; senão atribuir por client_cpf+credor+período)
  SELECT nc.agreement_id, nc.valor_pago::numeric, nc.data_pagamento::date
  FROM negociarie_cobrancas nc
  WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago'
),
pagos_filtrados AS (
  SELECT agreement_id, SUM(pago) AS pago
  FROM all_payments
  WHERE (_date_from IS NULL OR pago_em >= _date_from)
    AND (_date_to   IS NULL OR pago_em <= _date_to)
  GROUP BY agreement_id
)
```

**Decisão importante de semântica**: em `get_bi_revenue_summary`, `total_negociado` continua filtrado por `agreements.created_at` (acordos criados no período), mas `total_recebido` passa a usar `payment_date`. Isso bate com a interpretação operacional do cliente ("quanto entrou este mês"). `total_pendente` é recalculado com a nova base.

Antes da migração: validar se `negociarie_cobrancas.agreement_id` existe (caso contrário, será preciso fazer o vínculo via `client_cpf + credor`):

- Se `agreement_id` existir: usar direto.
- Se não existir: a CTE de Negociarie atribui o valor pelo CPF do cliente em vez do acordo (não compromete totais; só não atribui por operador).

### B. RPCs a reescrever

1. `get_bi_revenue_summary` — substituir o CTE `pagos` pela CTE `all_payments`+`pagos_filtrados`.
2. `get_bi_revenue_by_period` — agrupar pagamentos por `pago_em` (data do pagamento), não pelo `created_at` do acordo. Mantém negociado pelo `created_at`.
3. `get_bi_revenue_by_credor` — somar por credor através do JOIN do acordo, mas somando `pagos_filtrados`.
4. `get_bi_collection_funnel` e `get_bi_funnel_dropoff` — CTE `pays` passa a aceitar pagamentos das 3 fontes filtradas por `payment_date`/`updated_at`/`data_pagamento`.
5. `get_bi_operator_performance` — coluna `total_recebido` passa a usar `pagos_filtrados` (ainda atribuída ao `created_by` do acordo).
6. `get_bi_channel_performance` — `total_recebido_atribuido` idem.
7. `get_bi_score_vs_result` — CTE `pag` passa a usar `pagos_filtrados`.
8. `get_bi_score_distribution` — adicionar `DISTINCT ON (cpf, credor)` para alinhar com `score_vs_result`.
9. `get_bi_revenue_comparison` — herda automaticamente do `summary` corrigido. Sem mudança.

### C. Front — pequenos ajustes

`src/components/analytics/tabs/RevenueTab.tsx`:
- No bloco "Comparativo vs Período Anterior", quando `variation_pct` for `null`/`NaN`, mostrar `—` em cinza com o texto "Sem comparação" em vez de "+0,0%" verde (corrige o efeito visual enganoso visto no print).

Sem outras mudanças de front. Sem alterar nomes de tabs, layouts ou componentes recém-aprovados.

### D. Validação pós-migração

Rodar query de auditoria comparando Dashboard vs Analytics no tenant Y.BRASIL para Abril/2026 — esperado: ambos retornarem **R$ 95.705,33**. Repetir para Y.BRASIL Mar/2026 e qualquer outro tenant ativo para confirmar consistência.

---

## Arquivos tocados

- `supabase/migrations/<timestamp>_fix_bi_revenue_payment_sources.sql` (nova migração com 8 RPCs reescritas)
- `src/components/analytics/tabs/RevenueTab.tsx` (tratamento de `null` no comparativo)

Sem mudanças em: outras telas, Dashboard, Relatórios, lógica de pagamento, RLS, types.

---

## Fora do escopo

- Não vou alterar como `manual_payments`, `portal_payments` ou `negociarie_cobrancas` são gravados.
- Não vou criar tabelas novas nem `agreement_installments`.
- Não vou mexer no Dashboard (ele já está correto).
- Não vou tocar em mobile/responsividade.
