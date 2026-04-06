

# Plano: Corrigir prioridade de status_cobranca_id no agrupamento da Carteira

## Problema

Na função `get_carteira_grouped`, o `status_cobranca_id` do grupo é escolhido com esta prioridade:

```sql
CASE f.status
  WHEN 'pendente' THEN 1
  WHEN 'quebrado' THEN 2
  WHEN 'pago'     THEN 3
  ELSE 4
END
```

O status `em_acordo` cai no `ELSE` (prioridade 4), **depois** de `pago` (prioridade 3). Resultado: as 3 parcelas com status `pago` + `Quitado` são escolhidas antes das 17 parcelas com `em_acordo` + `Acordo Vigente`. O grupo inteiro aparece como "Quitado".

A cliente tem:
- 3 parcelas: status=`pago`, status_cobranca=`Quitado`
- 17 parcelas: status=`em_acordo`, status_cobranca=`Acordo Vigente`

## Correção

**Migration SQL** — alterar a função `get_carteira_grouped`, ajustando a prioridade para que `em_acordo` tenha prioridade **1** (mais alta), pois um acordo vigente é o estado mais relevante operacionalmente:

```sql
CASE f.status
  WHEN 'em_acordo' THEN 1
  WHEN 'pendente'  THEN 2
  WHEN 'quebrado'  THEN 3
  WHEN 'pago'      THEN 4
  ELSE 5
END
```

Também ajustar o `CASE` do campo `status` agregado para incluir `em_acordo`:

```sql
CASE
  WHEN bool_or(f.status = 'em_acordo') THEN 'em_acordo'
  WHEN bool_or(f.status = 'pendente')  THEN 'pendente'
  WHEN bool_or(f.status = 'quebrado')  THEN 'quebrado'
  ELSE 'pago'
END AS status
```

## Impacto

- Clientes com parcelas em acordo passarão a mostrar "Acordo Vigente" na listagem
- Filtrar por "Acordo Vigente" passará a incluir essas clientes
- Nenhuma alteração no frontend — apenas na função SQL

