

# Diagnóstico: Filtro "Status de Carteira" nao funciona

## Causa raiz

O `setFilters` em `CarteiraPage.tsx` (linhas 97-118) chama **16 `setSearchParams` separados** em sequencia. No React Router v6, cada chamada de `setSearchParams` dispara uma navegacao independente. Quando o React faz batching dessas atualizacoes, apenas a **ultima** chamada sobrevive, sobrescrevendo as anteriores. Como `setUrlStatusCobrancaId` e a 7a chamada de 16, o parametro `statusCobrancaId` na URL e apagado pela chamada seguinte.

Isso explica por que o filtro "Status de Carteira" parece nao filtrar: o valor e definido na URL mas imediatamente sobrescrito.

## Solucao

Refatorar `setFilters` para fazer **uma unica chamada** a `setSearchParams`, atualizando todos os parametros de uma vez:

```typescript
const setFilters = useMemo(() => {
  return (newFilters) => {
    const resolved = typeof newFilters === 'function' ? newFilters(filters) : newFilters;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      // Para cada filtro, setar ou deletar baseado no default
      // statusCobrancaId, status, credor, dateFrom, ...
      return next;
    }, { replace: true });
  };
}, [filters, setSearchParams]);
```

## Problema secundario: limite de 1000 linhas

O `fetchClients` nao define `.limit()` nem paginacao, entao usa o default de 1000 do Supabase. Com 9495 registros no banco, qualquer filtro que retorne >1000 registros perde dados. Isso nao e a causa principal do bug reportado, mas deve ser corrigido junto.

## Arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `src/pages/CarteiraPage.tsx` | Refatorar `setFilters` para usar 1 unica chamada `setSearchParams` ao inves de 16 chamadas individuais via `useUrlState` |

## O que NAO muda

- `ClientFilters.tsx` — zero alteracao
- `clientService.ts` — sem alteracao (filtro DB esta correto)
- Nenhuma mudanca de banco, edge function ou UI visual

