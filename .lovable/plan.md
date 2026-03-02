

## Plano: Corrigir busca por nome/CPF na Carteira

### Problema
A função `fetchClients` no `clientService.ts` **não aplica o filtro de busca (search) no banco de dados**. Ela busca todos os clientes (limitado a 1000 pelo Supabase) e filtra apenas no frontend via `displayClients`. Se o cliente procurado não está nos primeiros 1000 registros, ele nunca aparece.

Além disso, quando há um termo de busca, o resultado deveria mostrar **apenas** os clientes que correspondem, não a carteira inteira.

### Solução

**`src/services/clientService.ts`** — `fetchClients()`:
1. Aceitar o campo `search` nos filtros
2. Quando `search` estiver preenchido, aplicar filtro no banco: `or(nome_completo.ilike.%termo%,cpf.ilike.%termo%)` 
3. Isso garante que a busca funcione em toda a base, não só nos primeiros 1000

**`src/pages/CarteiraPage.tsx`**:
1. Passar `filters.search` para `fetchClients` via `filtersWithOperator`
2. Remover a filtragem client-side de `filters.search` no `displayClients` (pois já vem filtrado do banco)

### Arquivos
- **Editar**: `src/services/clientService.ts`
- **Editar**: `src/pages/CarteiraPage.tsx`

