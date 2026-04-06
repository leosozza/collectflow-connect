

# Plano: Corrigir prioridade de status `vencido` no agrupamento da Carteira

## Problema

A cliente Angélica de Jesus Santos tem 11 parcelas:
- 3 com status `pago` (Quitado)
- 4 com status `vencido` (Aguardando acionamento)
- 4 com status `pendente` (Em dia)

Na função `get_carteira_grouped`, o CASE que define a prioridade do `status_cobranca_id` é:

```sql
CASE f.status
  WHEN 'em_acordo' THEN 1
  WHEN 'pendente' THEN 2
  WHEN 'quebrado' THEN 3
  WHEN 'pago' THEN 4
  ELSE 5
END
```

O status `vencido` cai no ELSE (prioridade 5), ou seja, fica **depois** de `pendente` (prioridade 2). Resultado: o grupo pega o `status_cobranca_id` das parcelas `pendente` ("Em dia") em vez das parcelas `vencido` ("Aguardando acionamento").

O mesmo problema existe no campo `status` agregado — `vencido` não é tratado e cai no ELSE que retorna `'pago'`.

## Correção

Uma única migration SQL alterando a função `get_carteira_grouped` em dois pontos:

### 1. Prioridade do `status_cobranca_id`

```sql
CASE f.status
  WHEN 'vencido' THEN 1
  WHEN 'em_acordo' THEN 2
  WHEN 'pendente' THEN 3
  WHEN 'quebrado' THEN 4
  WHEN 'pago' THEN 5
  ELSE 6
END
```

`vencido` passa a ter a maior prioridade — parcelas em atraso sempre determinam o status do grupo.

### 2. Campo `status` agregado

```sql
CASE
  WHEN bool_or(f.status = 'vencido') THEN 'vencido'
  WHEN bool_or(f.status = 'em_acordo') THEN 'em_acordo'
  WHEN bool_or(f.status = 'pendente') THEN 'pendente'
  WHEN bool_or(f.status = 'quebrado') THEN 'quebrado'
  ELSE 'pago'
END AS status
```

### Impacto

- Todos os clientes com parcelas vencidas passarão a mostrar "Aguardando acionamento" na listagem
- Filtros por status de cobrança refletirão o estado real
- Nenhuma alteração no frontend — apenas na função SQL
- A Angélica e qualquer outro cliente na mesma situação será corrigido automaticamente

| Arquivo | Alteração |
|---|---|
| Migration SQL (`get_carteira_grouped`) | Adicionar `vencido` na prioridade do CASE |

