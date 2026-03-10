

## Plano: Mover Roadmap para Super Admin

### Alterações

**1. `src/pages/ConfiguracoesPage.tsx`**
- Remover a tab "Roadmap" do array `items` (linha 31)
- Remover o render condicional `{active === "roadmap" && <RoadmapPage />}`
- Remover import de `Map` (lucide) e `RoadmapPage`

**2. `src/components/SuperAdminLayout.tsx`**
- Adicionar item "Roadmap" no `navItems`, posicionado no final da lista (parte de baixo do sidebar), com ícone `Map` e path `/admin/roadmap`
- Adicionar entrada no `pageTitles`

**3. `src/App.tsx`**
- Adicionar rota `<Route path="/admin/roadmap" element={<RoadmapPage />} />` dentro do bloco de rotas do Super Admin
- Remover import de `RoadmapPage` se já não for usado em outro lugar (ainda é usado em ConfiguracoesPage, mas será removido de lá)

### Arquivos alterados
- `src/pages/ConfiguracoesPage.tsx`
- `src/components/SuperAdminLayout.tsx`
- `src/App.tsx`

