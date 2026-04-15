

# Correção: Dashboard ignora datas customizadas de parcelas

## Causa raiz

A RPC `get_dashboard_vencimentos` calcula as datas das parcelas usando fórmula fixa:
- Entrada: `COALESCE(entrada_date, first_due_date)`
- Regulares: `first_due_date + (i * '1 month')`

Quando o operador altera a data de uma parcela, o valor é salvo em `agreements.custom_installment_dates` (JSONB, ex: `{"2": "2026-05-15"}`), mas a RPC **nunca consulta essa coluna**. O dashboard continua mostrando a data calculada original.

## Solução

Atualizar a RPC `get_dashboard_vencimentos` para usar `custom_installment_dates` quando disponível, com fallback para a fórmula original.

### Lógica da mudança

Para a **entrada** (parcela 1 / key "entrada"):
```sql
-- De:
COALESCE(a.entrada_date, a.first_due_date)::date = _target_date
-- Para:
COALESCE(
  (a.custom_installment_dates->>'entrada')::date,
  a.entrada_date,
  a.first_due_date
)::date = _target_date
```

Para **parcelas regulares** (key = numero_parcela):
```sql
-- De:
(a.first_due_date::date + (i * interval '1 month'))::date = _target_date
-- Para:
COALESCE(
  (a.custom_installment_dates->>cast(
    CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END as text
  ))::date,
  (a.first_due_date::date + (i * interval '1 month'))::date
) = _target_date
```

A mesma substituição se aplica nas linhas que comparam a data com `CURRENT_DATE` para determinar o `effective_status` (overdue check).

### Arquivo
- Migration SQL: `CREATE OR REPLACE FUNCTION get_dashboard_vencimentos` com suporte a `custom_installment_dates`

### Resultado
- Parcelas com data alterada aparecem no dia correto no dashboard
- Parcelas sem alteração continuam usando a fórmula original (zero impacto)

