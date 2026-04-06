

# Plano: Corrigir inconsistências definitivas da Carteira

## 4 problemas, 4 correções

### 1. Resetar paginação ao mudar filtros

**Arquivo**: `src/pages/CarteiraPage.tsx`

Adicionar `useEffect` observando `rpcFilters` que reseta `page=1`, limpa `selectedIds` e `selectAllFiltered`:

```tsx
useEffect(() => {
  setUrlPage(1);
  setSelectedIds(new Set());
  setSelectAllFiltered(false);
}, [rpcFilters]);
```

Usar `JSON.stringify(rpcFilters)` como dependência para evitar loop por referência de objeto.

---

### 2. Agrupar por CPF + Credor (não apenas CPF)

**Arquivo**: Migration SQL — alterar `get_carteira_grouped`

Mudar o `GROUP BY f.cpf` para `GROUP BY f.cpf, f.credor`. Isso separa títulos de credores diferentes no agrupamento, impedindo mistura de dados.

Ajustes necessários na query:
- `grouped` CTE: `GROUP BY f.cpf, f.credor`
- Remover `credor` do `array_agg` (já vem do GROUP BY)
- O campo `credor` no SELECT final vem direto do agrupamento

---

### 3. Filtro "Sem acordo" respeitar CPF + Credor

Na mesma migration, ajustar o `sem_acordo_filter` CTE para comparar também o credor:

```sql
WHERE NOT _sem_acordo OR NOT EXISTS (
  SELECT 1 FROM agreements a
  WHERE a.tenant_id = _tenant_id
    AND a.status IN ('pending', 'approved')
    AND replace(replace(a.client_cpf, '.', ''), '-', '') = replace(replace(g.cpf, '.', ''), '-', '')
    AND a.credor = g.credor
)
```

---

### 4. Busca multi-termo — garantir consistência

Na mesma migration, mover a lógica de `_search_words` para fora do `RETURN QUERY` e garantir que o array vazio não cause falso positivo. Já foi parcialmente corrigido, mas vamos solidificar adicionando `array_length(_search_words, 1) > 0` como guard.

---

## Resumo de alterações

| Arquivo | Tipo |
|---|---|
| Migration SQL (`get_carteira_grouped`) | Alterado — GROUP BY cpf+credor, sem_acordo com credor, busca robusta |
| `src/pages/CarteiraPage.tsx` | Alterado — useEffect para resetar paginação ao mudar filtros |

Nenhuma alteração em: frontend de filtros, componentes visuais, serviços, backend, permissões.

