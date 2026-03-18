

# Plano: Persistir URL State entre navegações

## Problema
O `useUrlState` usa `useSearchParams` do React Router, que só reflete a URL atual. Ao navegar para outra rota e voltar, os search params são perdidos porque a URL muda.

## Solução: sessionStorage como fallback

Modificar o hook `useUrlState` (e `useUrlFilters`) em `src/hooks/useUrlState.ts` para:

1. **Na leitura**: Se a URL não tem o param, verificar `sessionStorage` antes de usar o default
2. **Na escrita**: Salvar o valor no `sessionStorage` junto com a URL
3. **No clear**: Limpar também do `sessionStorage`
4. **Namespace**: Usar `location.pathname` + key como chave do storage para evitar colisões entre rotas

### Implementação no `useUrlState`:
- Usar `useLocation().pathname` para gerar a chave de storage: `urlstate:{pathname}:{key}`
- No `useMemo` de leitura: se `searchParams.get(key)` é `null`, tentar `sessionStorage.getItem(storageKey)` antes de retornar `defaultValue`
- No `useEffect` de montagem: se há valor no sessionStorage mas não na URL, restaurar na URL (com `replace: true`)
- No `setValue`: além de atualizar searchParams, salvar no sessionStorage (ou remover se é default)

### Implementação no `useUrlFilters`:
- Mesma lógica: restaurar do sessionStorage na montagem, salvar ao setar filtros
- `clearAll` limpa também o sessionStorage

## Escopo
Apenas o arquivo `src/hooks/useUrlState.ts` precisa ser alterado. Todas as 15+ páginas que usam o hook herdam o comportamento automaticamente, sem necessidade de alteração individual.

## Resultado
Filtros, abas e ordenação persistem ao navegar entre páginas e voltar. Refresh da página também mantém o estado (pois a URL contém os params restaurados). Fechar o navegador limpa o estado (sessionStorage).

