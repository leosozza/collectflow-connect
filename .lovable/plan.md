

# Plano: Corrigir função duplicada `get_carteira_grouped`

## Problema

A migration que adicionou `_sem_whatsapp` usou `CREATE OR REPLACE`, mas como a assinatura (parâmetros) mudou, o PostgreSQL criou uma **segunda versão** da função em vez de substituir a original. Agora existem duas overloads e o PostgREST retorna erro `PGRST203` ("Could not choose the best candidate function").

Isso quebra **todos** os filtros da carteira, não apenas o novo.

## Correção

Uma única migration SQL que:

1. `DROP FUNCTION` da versão antiga (sem `_sem_whatsapp`) explicitamente pela assinatura completa
2. Manter a versão nova intacta (já está no banco)

### Migration SQL

```sql
DROP FUNCTION IF EXISTS public.get_carteira_grouped(
  uuid, integer, integer, text, text, date, date, 
  uuid[], uuid[], uuid[], integer, integer, text[], 
  text, text, uuid, boolean, date, date
);
```

Isso remove apenas a overload antiga (19 parâmetros) e preserva a nova (20 parâmetros, com `_sem_whatsapp`).

## Nenhuma alteração de código frontend necessária

O frontend já passa `_sem_whatsapp` corretamente. O problema é exclusivamente no banco.

| Arquivo | Alteração |
|---|---|
| Migration SQL (nova) | DROP da overload antiga de `get_carteira_grouped` |

