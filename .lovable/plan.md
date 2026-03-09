

## Adicionar permissão "Filtros Avançados" na Carteira

### O que será feito

1. **Nova ação `filter` no módulo `carteira`** no `usePermissions.ts`
   - Adicionar `"filter"` como ação disponível em `MODULE_AVAILABLE_ACTIONS.carteira`
   - Adicionar label `"Filtros Avançados"` em `ACTION_LABELS`
   - Dar acesso por padrão a `super_admin`, `admin`, `gerente`, `supervisor` — **não** ao `operador`

2. **Nova propriedade `canFilterCarteira`** exposta pelo hook `usePermissions`

3. **Modificar `ClientFilters`** para aceitar prop `showAdvancedFilters`
   - Se `false`: mostra apenas campo de busca (nome/CPF) + botão Pesquisar
   - Se `true`: mostra tudo como hoje (busca + botão Filtros avançados)

4. **Passar a permissão no `CarteiraPage`**
   - `<ClientFilters ... showAdvancedFilters={permissions.canFilterCarteira} />`

### Arquivos a modificar
- `src/hooks/usePermissions.ts` — nova ação `filter`, nova prop `canFilterCarteira`
- `src/components/clients/ClientFilters.tsx` — prop `showAdvancedFilters` controla visibilidade
- `src/pages/CarteiraPage.tsx` — passa `showAdvancedFilters={permissions.canFilterCarteira}`

