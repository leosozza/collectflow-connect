## Problema

O gráfico **"Projeção por Mês"** hoje filtra apenas `agreement_installments.is_entrada = true`. Acordos **sem entrada** (parcelamento puro) ficam de fora, e o valor diverge do **"Provisionado no Mês"** do Dashboard.

## Regra correta (igual ao Dashboard)

Para **cada acordo criado no dia**, somar **uma única parcela**:

- Se `agreements.entrada_value > 0` → soma a **entrada** (`custom_installment_values->>'entrada'` com fallback para `entrada_value`).
- Senão → soma a **1ª parcela** (`custom_installment_values->>'1'` com fallback para `new_installment_value`).

Isso é exatamente o bloco `_negociado` (Provisionado) de `get_dashboard_stats`. A única diferença é que aqui o resultado é agrupado **por dia de criação** para gerar a série acumulada do mês.

## Mudança

### Backend — reescrever `get_bi_projected_by_day`

```
get_bi_projected_by_day(
  _tenant_id uuid,
  _date_from date,
  _date_to date,
  _credor text[] default null,
  _operator_ids uuid[] default null
) returns table(ref_date date, total_projetado numeric)
```

Implementação:

```sql
SELECT
  a.created_at::date AS ref_date,
  SUM(
    CASE WHEN a.entrada_value > 0
      THEN COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value)
      ELSE COALESCE((a.custom_installment_values->>'1')::numeric, a.new_installment_value)
    END
  ) AS total_projetado
FROM public.agreements a
WHERE a.tenant_id = _tenant_id
  AND a.status <> 'cancelled'
  AND a.created_at::date BETWEEN _date_from AND _date_to
  AND (_credor IS NULL OR a.credor = ANY(_credor))
  AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
GROUP BY a.created_at::date;
```

- `SECURITY DEFINER`, `search_path=public`, guard `can_access_tenant(_tenant_id)`.
- Sem CTE de `agreement_installments` — espelha 1:1 a lógica do Dashboard, evitando divergência futura.

### Frontend

Nenhuma mudança em `RevenueTab.tsx` — o contrato da RPC (campos `ref_date` / `total_projetado`) continua igual. Atualiza apenas a descrição do card:

> "Acumulado diário do valor provisionado (entrada ou 1ª parcela quando não há entrada) dos acordos negociados no mês — mesma regra do 'Provisionado no Mês' do Dashboard. Mês atual em azul, mês selecionado pontilhado para comparação."

### Memória

Atualizar `mem://logic/dashboard/value-prioritization` (ou criar nota nova) registrando que **"Projeção por Mês" e "Provisionado no Mês" devem usar a mesma fórmula** (entrada → fallback 1ª parcela, por `created_at`), para impedir regressões.

## Validação

Para o mês corrente, a soma de **todos os pontos diários** do gráfico (linha azul até hoje) deve **bater exatamente** com o valor exibido em **"Provisionado no Mês"** no Dashboard, com os mesmos filtros (credor/operador desativados ou alinhados).

## Fora de escopo

- Dashboard, demais cards/KPIs, filtros globais.
- Componente visual do gráfico (cores, seletor de mês, legenda) — já estão como pedido.
