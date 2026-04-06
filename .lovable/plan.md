

# Plano: Corrigir contagem e fetch completo da seleção global

## Causa raiz

Ambas as funções `fetchAllCarteiraIds` e `fetchAllCarteiraClients` usam `pageSize = 5000`, mas o Supabase limita respostas RPC a **1.000 linhas**. Como `rows.length < 5000` é sempre verdadeiro no primeiro batch (retorna ≤1.000), o loop para imediatamente. Resultado: apenas ~1.000 grupos são retornados.

Isso causa **3 sintomas visíveis**:
1. **Banner**: "3.529 clientes filtrados" (deveria ser 11.137) — usa `selectedIds.size` que vem do `fetchAllCarteiraIds` truncado
2. **Botões**: WhatsApp/Discador/Higienizar mostram (3529) — usam `selectedCount = selectedIds.size`
3. **Dialog do Discador**: "1000 clientes selecionados" — `fetchAllCarteiraClients` retornou só 1 batch

## Correções

### 1. Reduzir batch size para 1.000 em `src/services/clientService.ts`

Em `fetchAllCarteiraIds` (linha 514) e `fetchAllCarteiraClients` (linha 588):

```tsx
const pageSize = 1000; // era 5000
```

Isso faz o loop paginar corretamente por todas as páginas.

### 2. Usar `totalCount` nos contadores quando selectAllFiltered — `src/pages/CarteiraPage.tsx`

Linha 525-527 — quando `selectAllFiltered=true`, usar `totalCount` (já disponível da query principal) em vez de `selectedIds.size`:

```tsx
const selectedCount = selectAllFiltered
  ? totalCount
  : new Set(selectedClients.map(c => c.cpf.replace(/\D/g, ""))).size;
```

### 3. Banner usar `totalCount` — `src/pages/CarteiraPage.tsx`

Linha 692 — trocar `selectedIds.size` por `totalCount`:

```tsx
Todos os {totalCount.toLocaleString("pt-BR")} clientes filtrados estão selecionados.
```

## Resumo

| Arquivo | Alteração |
|---|---|
| `src/services/clientService.ts` | `pageSize` 5000 → 1000 em ambas as funções |
| `src/pages/CarteiraPage.tsx` | `selectedCount` e banner usam `totalCount` quando selectAllFiltered |

