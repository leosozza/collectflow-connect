

# Otimização da Navegação — Layout Persistente + Skeleton Loaders

## Problema
Cada rota renderiza uma nova instância de `<AppLayout>`, causando remontagem do sidebar e header a cada navegação. Páginas como `ClientDetailPage` substituem todo o conteúdo por "Carregando..." durante o fetch.

## Alterações

### 1. `src/components/AppLayout.tsx`
- Remover a prop `children` e a interface `AppLayoutProps`
- Importar `Outlet` do `react-router-dom`
- Substituir `{children}` por `<Outlet />` no `<main>`

### 2. `src/App.tsx`
- Criar uma rota pai com `element={<ProtectedRoute requireTenant><AppLayout /></ProtectedRoute>}`
- Mover todas as rotas que hoje usam `<ProtectedRoute requireTenant><AppLayout>...</AppLayout></ProtectedRoute>` para dentro dessa rota pai como rotas filhas com apenas o componente de página
- A rota raiz `/` (RootPage) permanece separada pois tem lógica condicional própria
- Rotas sem AppLayout (auth, onboarding, portal, admin, etc.) permanecem inalteradas

Exemplo da estrutura:
```text
<Route element={<ProtectedRoute requireTenant><AppLayout /></ProtectedRoute>}>
  <Route index element={<Index />} />
  <Route path="carteira" element={<CarteiraPage />} />
  <Route path="carteira/:cpf" element={<ClientDetailPage />} />
  <Route path="cadastros/:tab?" element={<CadastrosPage />} />
  ...todas as rotas protegidas com AppLayout...
</Route>
```

A rota `/` precisará de tratamento especial: o `RootPage` decide entre LandingPage (sem layout) e redirecionar para o layout. Vou ajustar para que usuários logados não-superadmin caiam na rota index dentro do layout group.

### 3. `src/pages/ClientDetailPage.tsx`
- Substituir o bloco `if (isLoading) return <div>Carregando...</div>` por skeleton loaders que mantêm a estrutura da página visível (header com botão voltar, tabs, cards esqueleto)

### 4. Outras páginas com loading genérico
- Aplicar o mesmo padrão de skeleton em páginas que usam loading full-replacement (buscar e corrigir os principais: `PerfilPage`, `ConfiguracoesPage`, etc.)

## O que NÃO muda
- Lógica de autenticação e proteção de rotas
- Rotas do SuperAdmin (já usam `SuperAdminLayout` com Outlet)
- ModuleGuard continua envolvendo as rotas que precisam

## Resultado
- Sidebar e header nunca remontam durante navegação entre páginas protegidas
- Estado do sidebar (collapsed, scroll) é preservado
- Carregamento de dados acontece de forma fluida com skeletons dentro do layout já montado

## Arquivos alterados
- `src/components/AppLayout.tsx`
- `src/App.tsx`
- `src/pages/ClientDetailPage.tsx`
- `src/pages/PerfilPage.tsx`

