

# Plano: Corrigir RPCs do Dashboard para respeitar `custom_installment_values`

## Problema raiz

Quando o operador edita o valor de uma parcela (ex: entrada de R$5 → R$11), o sistema salva a mudança no campo JSON `custom_installment_values` (ex: `{"entrada": 11}`). Porém, as **RPCs SQL do dashboard** leem diretamente os campos originais `entrada_value` e `new_installment_value`, ignorando completamente as edições personalizadas.

Resultado: o dashboard continua mostrando R$5 (valor original) em vez de R$11 (valor editado).

## Onde está o bug

Ambas as RPCs usam `a.entrada_value` e `a.new_installment_value` diretamente:

- **`get_dashboard_stats`**: Calcula Colchão, Primeira Parcela, Negociado no Mês, Quebra e Pendentes usando os valores originais
- **`get_dashboard_vencimentos`**: Retorna `a.entrada_value` como `valor_parcela` para entradas e `a.new_installment_value` para parcelas regulares

## Correção

Uma única migration SQL que reescreve ambas as RPCs para usar `COALESCE` com `custom_installment_values`:

```text
-- Para entrada:
COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value)

-- Para parcela regular (número i):
COALESCE((a.custom_installment_values->>cast(num AS text))::numeric, a.new_installment_value)
```

### `get_dashboard_vencimentos`
- Entrada: substituir `a.entrada_value AS valor_parcela` por `COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value)`
- Parcelas regulares: substituir `a.new_installment_value AS valor_parcela` por `COALESCE((a.custom_installment_values->>cast(numero AS text))::numeric, a.new_installment_value)` onde `numero` é o número efetivo da parcela

### `get_dashboard_stats`
- Aplicar a mesma lógica de COALESCE em todos os 5 cálculos que usam `entrada_value` / `new_installment_value`: Colchão, Primeira Parcela, Negociado Mês, Quebra e Pendentes

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Reescrever `get_dashboard_stats` e `get_dashboard_vencimentos` para usar `custom_installment_values` com fallback |

Nenhuma mudança em frontend — o problema é 100% nas RPCs SQL.

