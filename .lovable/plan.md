

## Plano: Super Admin exclusivo na área `/admin`

### Problema
Atualmente o Super Admin, ao fazer login, cai no fluxo de tenant (Dashboard, AppLayout). O Super Admin da RIVO não é um tenant — ele deve ver **apenas** a área `/admin` com o `SuperAdminLayout`.

### Alterações

**1. `RootPage` em `App.tsx`**
- Após autenticação, verificar se o usuário é `super_admin` via `useTenant`
- Se for super_admin → redirecionar para `/admin` (nunca mostrar AppLayout)
- Se não for → fluxo normal (tenant dashboard)

**2. `SuperAdminLayout.tsx`**
- Remover o link "Voltar ao Sistema" (`/`) do footer — super admin não tem acesso ao sistema tenant
- Manter apenas o botão "Sair"

**3. `ProtectedRoute.tsx`**
- Nas rotas `requireTenant`: se o usuário for `super_admin`, redirecionar para `/admin` em vez de `/onboarding`
- Isso impede que o super admin caia no onboarding por não ter tenant

**4. `AppLayout.tsx`**
- Remover qualquer link "Área Admin" do sidebar dos tenants (super admin não usa AppLayout)

### Arquivos alterados
- `src/App.tsx` — `RootPage` redireciona super_admin para `/admin`
- `src/components/ProtectedRoute.tsx` — super_admin bypass do requireTenant
- `src/components/SuperAdminLayout.tsx` — remover "Voltar ao Sistema"
- `src/components/AppLayout.tsx` — remover link de admin do sidebar

