

# Correção: Coluna `motivo_devolucao` ausente na tabela `clients`

## Problema

A edge function `maxlist-import` (linha 359) mapeia o campo `CheckReturnReason` da API MaxSystem para `motivo_devolucao`, mas essa coluna não existe na tabela `clients`. Isso causa falha em **todos os batches** de upsert, resultando em 0 inseridos/atualizados.

## Solução

### 1. Migration: adicionar coluna `motivo_devolucao`

```sql
ALTER TABLE public.clients ADD COLUMN motivo_devolucao text;
```

Apenas isso. Uma coluna `text` nullable, sem constraints.

### 2. Nenhuma alteração na edge function

O código já está correto — só faltava a coluna no banco.

## Resultado

Após a migration, a importação/atualização MaxList voltará a funcionar normalmente. Os registros com cheque devolvido receberão o código do motivo de devolução.

