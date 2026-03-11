

# Correção dos Cards: Recebido, Quebra e Pendentes

## Análise do Problema

| Card | Lógica Atual (Errada) | Lógica Correta |
|------|----------------------|----------------|
| **Total Recebido** | Soma `valor_pago` de clients com status 'pago' que têm acordo | Soma `valor_pago` de clients com `data_quitacao` no mês selecionado, vinculados a acordos |
| **Total de Quebra** | Soma `proposed_total` (valor total do acordo!) de acordos cancelled/overdue | Soma apenas as parcelas virtuais que cairiam no mês, de acordos **cancelled** apenas (overdue não conta) |
| **Pendentes** | `projetado - recebido - quebra` (fórmula genérica) | Soma das parcelas do mês de acordos ativos (pending, approved, **overdue**) que ainda não foram pagos nem quebrados |

## Mudança: Migration SQL — `get_dashboard_stats`

### Total Recebido
```sql
-- Soma valor_pago de títulos com data_quitacao no mês, vinculados a acordos do operador
SELECT SUM(c.valor_pago) FROM clients c
WHERE c.data_quitacao BETWEEN _month_start AND _month_end
  AND EXISTS (SELECT 1 FROM agreements a WHERE cpf matches AND ...)
```

### Total de Quebra
```sql
-- Parcelas virtuais (entrada + mensalidades) de acordos CANCELLED com vencimento no mês
SELECT SUM(parcela_valor) FROM (
  -- entrada de acordos cancelled com vencimento no mês
  UNION ALL
  -- mensalidades de acordos cancelled com vencimento no mês
) sub
-- NÃO inclui overdue
```

### Pendentes
```sql
-- Todas as parcelas do mês de acordos ativos (pending, approved, overdue)
-- Mesma lógica de parcelas virtuais, mas com status IN ('pending','approved','overdue')
-- Inclui acordos de meses anteriores E do mês atual
SELECT SUM(parcela_valor) FROM virtual_installments
WHERE status IN ('pending', 'approved', 'overdue')
  AND due_date BETWEEN _month_start AND _month_end
```

## Arquivo

| Arquivo | Ação |
|---|---|
| Nova migration SQL | Atualizar `get_dashboard_stats` — recalcular recebido, quebra e pendentes |

Nenhuma mudança no frontend — os campos mantêm os mesmos nomes. A lógica do operador já funciona via `_user_id` filter.

