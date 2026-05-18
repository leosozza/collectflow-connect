## Objetivo

Substituir o conteúdo do gráfico **Evolução do Período** (aba Receita do Analytics) por uma comparação de **valor projetado acumulado** entre o mês selecionado e o mês anterior, espelhando o mesmo dia.

Exemplo: hoje é 18/05 → o gráfico mostra a linha do mês atual indo até 18/05 (acumulado projetado R$ 80k) sobreposta à linha do mês anterior indo até 18/04 (acumulado projetado R$ 100k). O usuário enxerga rapidamente se está projetando mais ou menos do que no mesmo ponto do mês passado.

## Definição de "Projetado"

Projetado = soma dos valores de **parcelas de acordo com vencimento naquele dia** (`agreement_installments.due_date`), considerando apenas acordos não cancelados.

- Base: `agreement_installments` filtrada por `tenant_id`, `cancelled = false`, e `agreements.status <> 'cancelled'`.
- Valor: `SUM(amount)` agrupado por `due_date`.
- Inclui parcelas já pagas e em aberto (é a projeção original do acordo, não o realizado).
- Respeita filtros existentes da aba: credor, operador (`agreements.created_by`).

## Mudanças

### 1. Backend — nova RPC `get_bi_projected_by_day`

Retorna série diária do projetado para um intervalo arbitrário, permitindo o frontend buscar mês atual e mês anterior separadamente.

Assinatura (espelhando padrão das demais `get_bi_*`):

```
get_bi_projected_by_day(
  _tenant_id uuid,
  _date_from date,
  _date_to date,
  _credor text[] default null,
  _operator_ids uuid[] default null
) returns table(due_date date, total_projetado numeric)
```

Implementação: `SELECT ai.due_date, SUM(ai.amount)` de `agreement_installments ai JOIN agreements a` com os filtros acima, agrupado por `due_date`. `SECURITY DEFINER`, `search_path=public`, guard via `can_access_tenant(_tenant_id)`.

### 2. Frontend — `src/components/analytics/tabs/RevenueTab.tsx`

Substituir a query `byPeriod` (que usa `get_bi_revenue_by_period` com granularidade) por duas queries chamando a nova RPC:

- `projectedCurrent`: intervalo = primeiro dia até último dia do mês selecionado.
- `projectedPrev`: intervalo = mesmo recorte do mês anterior.

Construir série única indexada por **dia do mês (1..31)** com dois campos:
- `value` = acumulado projetado mês atual até aquele dia (null para dias > hoje, quando o mês selecionado é o corrente).
- `prevValue` = acumulado projetado mês anterior até aquele dia.

Padrão de acumulação e corte por "dia de hoje" segue o já implementado em `src/components/dashboard/TotalRecebidoCard.tsx` (mesma família visual).

Atualizar:
- Título do card: **"Projeção do Período"**.
- Descrição (`AnalyticsCardHeader`): "Acumulado projetado (soma das parcelas com vencimento no período) — mês atual sobreposto ao mesmo intervalo do mês anterior."
- Legenda: "Projetado (atual)" e "Projetado (mês anterior)".
- Tooltip: formatar como moeda; label por dia.

### 3. Comportamento

- Quando o mês selecionado **não** for o corrente, ambas as linhas vão até o último dia do mês (sem corte por "hoje").
- Quando for o mês corrente, a linha atual para no dia de hoje e a anterior continua até o dia equivalente (igual lógica do `TotalRecebidoCard`).
- Filtros da `AnalyticsFiltersBar` (credor, operador, período) continuam sendo aplicados.

## Fora de escopo

- Não alterar `get_bi_revenue_by_period`, `get_bi_revenue_summary`, `get_bi_revenue_comparison`, `get_bi_revenue_by_credor` — continuam alimentando os KPIs e o ranking.
- Não mexer no `TotalRecebidoCard` do dashboard.
- Sem novos filtros ou novos cards.

## Validação

- Checar que para 18/05 o acumulado bate com `SELECT SUM(amount) FROM agreement_installments WHERE due_date BETWEEN '2026-05-01' AND '2026-05-18' ...`.
- Comparar com `SELECT SUM(amount) ... BETWEEN '2026-04-01' AND '2026-04-18'` para a linha do mês anterior no mesmo ponto.
