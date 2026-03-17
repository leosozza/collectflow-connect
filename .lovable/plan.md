

# Fix: Tabulações não aparecem no Histórico de Atendimento

## Causa raiz

A query `fetchDispositions` em `dispositionService.ts` usa `.select("*, profiles:operator_id(full_name)")` para buscar o nome do operador via join. Porém, a tabela `call_dispositions` **não possui foreign key** no campo `operator_id` apontando para `profiles`. O PostgREST retorna **erro 400** e a query inteira falha, resultando em `dispositions = []` — por isso nada aparece na timeline.

## Solução (2 partes)

### 1. Migration: Adicionar FK de `operator_id` → `profiles(id)`

```sql
ALTER TABLE public.call_dispositions
  ADD CONSTRAINT call_dispositions_operator_id_fkey
  FOREIGN KEY (operator_id) REFERENCES public.profiles(id);
```

Isso permite o join do PostgREST funcionar corretamente.

### 2. Fallback defensivo no `fetchDispositions`

Caso o join falhe por algum motivo, fazer um fallback para `select("*")` sem o join, para que as disposições sempre apareçam (mesmo sem o nome do operador).

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Nova migration SQL | Adicionar FK `operator_id` → `profiles(id)` |
| `src/services/dispositionService.ts` | Adicionar try/catch com fallback para `select("*")` caso o join falhe |

## O que NÃO muda
- Nenhuma alteração de UI
- Nenhuma edge function
- Lógica de criação de disposição permanece igual

