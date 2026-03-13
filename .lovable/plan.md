

# Consolidar Usuários, Equipes e Permissões em uma única página com abas

## Resumo

Criar um item **"Usuários"** no grupo **Configurações** do sidebar do Super Admin. Essa página terá 3 abas:
- **Gestão de Usuários** (conteúdo atual de `AdminUsuariosPage`)
- **Gestão de Equipes** (conteúdo atual de `AdminEquipesPage`)
- **Permissões e Módulos** (conteúdo atual de `AdminPermissoesPage`)

## Alterações

### 1. Nova página: `src/pages/admin/AdminUsuariosHubPage.tsx`
- Página com `Tabs` (Radix) contendo 3 abas
- Cada aba renderiza o componente da página existente como conteúdo embarcado
- Suporte a query param `?tab=` para navegação direta

### 2. `SuperAdminLayout.tsx`
- Remover do sidebar: "Gestão de Equipes" (grupo Operação), "Permissões e Módulos" e "Gestão de Usuários" (grupo Configurações)
- Adicionar no grupo Configurações: `{ label: "Usuários", icon: Users, path: "/admin/usuarios", moduleSlug: "gestao_usuarios" }`
- Atualizar `ROUTE_MODULE_MAP` e `pageTitles` — remover entradas de `/admin/equipes` e `/admin/permissoes`
- Atualizar pageTitles: `/admin/usuarios` → "Usuários"

### 3. `App.tsx`
- Remover rotas separadas `/admin/equipes` e `/admin/permissoes`
- Rota `/admin/usuarios` aponta para `AdminUsuariosHubPage`
- Importar nova página, remover imports antigos das rotas (manter os componentes pois serão usados como conteúdo das abas)

### 4. Arquivos existentes mantidos
- `AdminUsuariosPage.tsx`, `AdminEquipesPage.tsx`, `AdminPermissoesPage.tsx` continuam existindo como componentes reutilizados dentro das abas

