## Objetivo

Substituir o gráfico atual ("Projeção do Período") por **"Projeção por Mês"**, que mostra o **acumulado diário das entradas/primeiras parcelas dos acordos negociados dentro do mês**, comparando o **mês atual** (linha azul sólida) com um **mês selecionável** (linha pontilhada), via seletor no topo do próprio gráfico.

## Nova definição de "Projetado"

Projetado = **soma do valor da entrada (1ª parcela) dos acordos criados naquele dia**, acumulado ao longo do mês.

- Base: `agreements` filtrada por `tenant_id`, `status <> 'cancelled'`.
- Eixo X (dia): `DATE(agreements.created_at)` no fuso do tenant.
- Valor: soma de `agreement_installments.amount` apenas para a **parcela de entrada** de cada acordo (ou seja, a parcela com menor `installment_number`/menor `due_date` daquele acordo — convenção canônica `installment-key-canonical`).
- Respeita filtros existentes da aba: credor, operador (`agreements.created_by`).

Isto difere do "Provisionado no mês" do Dashboard (que usa o valor total do acordo). Aqui pegamos só a entrada, alinhado à intenção de medir "quanto entra de fato como primeira parcela negociada".

## Mudanças

### 1. Backend — substituir RPC `get_bi_projected_by_day`

Reescrever a função para retornar série diária da **entrada negociada por dia de criação do acordo**:

```
get_bi_projected_by_day(
  _tenant_id uuid,
  _date_from date,
  _date_to date,
  _credor text[] default null,
  _operator_ids uuid[] default null
) returns table(ref_date date, total_projetado numeric)
```

Implementação (resumo):
- CTE `entrada` seleciona, para cada `agreement_id`, a parcela com `MIN(installment_number)` (fallback `MIN(due_date)`) de `agreement_installments` não canceladas.
- JOIN com `agreements` filtrando `created_at::date BETWEEN _date_from AND _date_to`, `status <> 'cancelled'`, `tenant_id`, e filtros opcionais de credor/operador.
- `GROUP BY created_at::date`, retornando `SUM(entrada.amount)`.
- `SECURITY DEFINER`, `search_path=public`, guard `can_access_tenant(_tenant_id)`.

### 2. Frontend — `src/components/analytics/tabs/RevenueTab.tsx`

- **Renomear** card para **"Projeção por Mês"**.
- **Descrição**: "Acumulado diário do valor de entrada (1ª parcela) dos acordos negociados no mês. Mês atual em azul, mês selecionado pontilhado para comparação."
- **Adicionar seletor de mês** no topo direito do card (dentro do header do gráfico), usando `<Select>` shadcn com as últimas 12 opções de mês (formato "mai/2026"). Estado local `comparisonMonth` (default = mês anterior ao atual).
- Substituir queries:
  - `projectedCurrent`: intervalo do mês corrente (`startOfMonth(today)` → `endOfMonth(today)`).
  - `projectedComparison`: intervalo do mês selecionado no novo seletor.
- Manter lógica de acumulação por dia (1..N) com corte por "hoje" só para a linha do mês atual.
- **Cores/estilos**:
  - Linha atual: `hsl(217, 91%, 60%)` (azul), sólida, `strokeWidth=2.5`.
  - Linha comparação: `hsl(var(--muted-foreground))`, **pontilhada** (`strokeDasharray="4 4"`), `strokeWidth=2`.
- **Legenda** dinâmica refletindo o mês escolhido: "Mês atual (mai/2026)" e "Comparativo (abr/2026)".
- Remover dependência do `_date_to` dos filtros globais para definir o "mês atual" — passa a ser sempre o mês corrente real (`new Date()`), conforme pedido.

### 3. Comportamento

- Linha azul vai até **hoje** (dia atual).
- Linha pontilhada vai até o último dia do mês selecionado.
- Filtros globais de credor/operador continuam aplicados.
- Trocar mês no seletor refaz só a query de comparação (cache por `yyyy-MM`).

## Fora de escopo

- Não alterar dashboard (`TotalRecebidoCard`, "Provisionado no mês").
- Não mexer nos demais cards/KPIs da aba Receita.
- Filtros globais de data da `AnalyticsFiltersBar` deixam de afetar este gráfico específico (mês atual é fixo); demais cards seguem usando.

## Validação

- Para 18/05: linha azul no dia 18 ≈ `SUM(entrada.amount)` de acordos criados entre 01/05 e 18/05.
- Linha pontilhada (ex.: abr) no dia 30 ≈ total acumulado de entradas de abril.
- Trocar comparativo recarrega só a segunda linha.
