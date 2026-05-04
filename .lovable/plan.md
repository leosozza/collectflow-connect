## Objetivo

Filtro **"Primeira Parcela De / Até"** (Carteira) deve retornar **apenas clientes que possuam parcela em aberto com vencimento dentro do período selecionado**. Clientes sem parcelas em aberto, ou cujas parcelas em aberto estejam fora da faixa, não devem aparecer.

## Causa raiz

A RPC `public.get_carteira_grouped` aplica o filtro sobre `MIN(f.data_vencimento)` considerando todas as parcelas (incluindo `pago`):

```sql
HAVING (_primeira_parcela_de IS NULL OR MIN(f.data_vencimento) >= _primeira_parcela_de)
   AND (_primeira_parcela_ate IS NULL OR MIN(f.data_vencimento) <= _primeira_parcela_ate)
```

## Correção

Migração SQL: `CREATE OR REPLACE FUNCTION public.get_carteira_grouped(...)` mantendo assinatura idêntica, alterando apenas o `HAVING` da CTE `grouped` para usar parcelas com `status <> 'pago'` e exigir presença dessas parcelas quando o filtro estiver ativo:

```sql
HAVING (
  (_primeira_parcela_de IS NULL AND _primeira_parcela_ate IS NULL)
  OR (
    MIN(f.data_vencimento) FILTER (WHERE f.status <> 'pago') IS NOT NULL
    AND (_primeira_parcela_de  IS NULL OR MIN(f.data_vencimento) FILTER (WHERE f.status <> 'pago') >= _primeira_parcela_de)
    AND (_primeira_parcela_ate IS NULL OR MIN(f.data_vencimento) FILTER (WHERE f.status <> 'pago') <= _primeira_parcela_ate)
  )
)
```

## Comportamento resultante

- **Cliente 100% quitado**: `MIN(...) FILTER` = NULL → excluído quando filtro ativo.
- **Cliente com parcelas pagas + em aberto**: avalia somente a 1ª parcela em aberto.
- **Sem filtro preenchido**: comportamento idêntico ao atual.

Sem alterações no frontend.