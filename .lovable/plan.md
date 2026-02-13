

# Ajustes de Acesso para Operador

## 3 Alteracoes Necessarias

### 1. Liberar Contact Center para Operador (sidebar)

No `AppLayout.tsx`, mover os itens de `contactCenterItems` para fora da condicao `isAdmin`, permitindo que operadores vejam a secao "Contact Center" com a aba WhatsApp. A aba Telefonia continuara com restricao de admin dentro da propria pagina (`ContactCenterPage.tsx`).

### 2. Remover "Log de Importacoes" do menu do Operador

No `AppLayout.tsx`, remover o item `{ label: "Log de Importações", path: "/cadastro" }` do array `preContactItems` que atualmente aparece para nao-admins (linha 50). Esse item so deve aparecer na secao "Avancado" para admins.

### 3. Filtrar Carteira por Operador (apenas clientes vinculados)

No `clientService.ts`, na funcao `fetchClients`, adicionar um filtro por `operator_id` quando o usuario for operador. O `profile.id` do operador sera passado como parametro.

No `CarteiraPage.tsx`, passar o `profile.id` e o role do usuario para a funcao `fetchClients`, aplicando o filtro `operator_id` somente quando o usuario nao for admin.

## Detalhes Tecnicos

**Arquivo: `src/components/AppLayout.tsx`**
- Remover a linha com "Log de Importacoes" do `preContactItems` (condicao `!isAdmin`)
- Mover `contactCenterItems` para fora do bloco `isAdmin`, mantendo Telefonia e WhatsApp visiveis para todos. A restricao de acesso a Telefonia ja existe em `ContactCenterPage.tsx`

**Arquivo: `src/services/clientService.ts`**
- Adicionar parametro opcional `operatorId?: string` na funcao `fetchClients`
- Quando `operatorId` for informado, adicionar `.eq("operator_id", operatorId)` na query

**Arquivo: `src/pages/CarteiraPage.tsx`**
- Usar `useTenant` para verificar se o usuario e admin
- Se nao for admin, passar `profile.id` como `operatorId` para `fetchClients`

Nenhuma alteracao no banco de dados e necessaria -- a coluna `operator_id` ja existe na tabela `clients` e o RLS ja filtra por tenant.

