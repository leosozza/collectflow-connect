

# Sistema Completo de Permissões — Super Admin RiVO Connect

## Resumo

Criar sistema de permissões granulares para o painel Super Admin, com tabelas de módulos e permissões por usuário, interface de gerenciamento, sidebar dinâmico e proteção de rotas.

## 1 — Banco de Dados (2 migrações)

### Tabela `sa_modules` — Cadastro de módulos do Super Admin
```sql
CREATE TABLE public.sa_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sidebar_group text NOT NULL,
  icon text,
  route_path text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```
Seed com os 11 módulos: `dashboard`, `suporte`, `gestao_equipes`, `treinamentos_reunioes`, `servicos_tokens`, `permissoes_modulos`, `agentes_digitais`, `integracoes`, `gestao_inquilinos`, `gestao_financeira`, `roadmap`.

### Tabela `sa_user_permissions` — Permissões individuais por usuário
```sql
CREATE TABLE public.sa_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_slug text NOT NULL REFERENCES sa_modules(slug) ON DELETE CASCADE,
  can_view boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_slug)
);
```

### RLS — Apenas super_admins acessam
- `sa_modules`: SELECT para authenticated, gerenciamento para super_admins
- `sa_user_permissions`: Todas as operações restritas a super_admins via `is_super_admin(auth.uid())`

### Função SECURITY DEFINER
```sql
CREATE FUNCTION get_my_sa_permissions()
RETURNS TABLE(module_slug text, can_view bool, can_create bool, can_edit bool, can_delete bool)
```
Retorna as permissões do usuário logado sem recursão RLS.

## 2 — Hook `useSAPermissions`

Novo arquivo: `src/hooks/useSAPermissions.ts`

- Chama `get_my_sa_permissions()` via RPC
- Retorna mapa `{ [slug]: { canView, canCreate, canEdit, canDelete } }`
- Super admin (owner) tem tudo liberado por padrão
- Expõe `hasView(slug)`, `hasCreate(slug)`, `hasEdit(slug)`, `hasDelete(slug)`

## 3 — Service `saPermissionService.ts`

Novo arquivo: `src/services/saPermissionService.ts`

- `fetchModules()` — lista todos os módulos
- `fetchUserPermissions(userId)` — permissões de um usuário
- `saveUserPermissions(userId, permissions[])` — upsert em lote
- `fetchSuperAdminUsers()` — lista usuários com role super_admin ou que têm permissões SA

## 4 — Página "Permissões e Módulos"

Novo arquivo: `src/pages/admin/AdminPermissoesPage.tsx`

**Layout:**
1. Seletor de usuário (dropdown com todos os colaboradores super_admin)
2. Tabela de permissões com checkboxes:

```text
┌──────────────────────────┬─────┬───────┬────────┬─────────┐
│ Módulo                   │ Ver │ Criar │ Editar │ Excluir │
├──────────────────────────┼─────┼───────┼────────┼─────────┤
│ Dashboard                │ [✓] │ [ ]   │ [ ]    │ [ ]     │
│ Suporte                  │ [✓] │ [✓]   │ [✓]    │ [ ]     │
│ Gestão de Equipes        │ [✓] │ [✓]   │ [✓]    │ [ ]     │
│ ...                      │     │       │        │         │
└──────────────────────────┴─────┴───────┴────────┴─────────┘
```

3. Botão "Salvar Permissões" com toast de confirmação
4. Badge visual por grupo (Operação, Automação e Serviços, etc.)

## 5 — Rota e Sidebar

### Nova rota em `App.tsx`:
```
<Route path="/admin/permissoes" element={<AdminPermissoesPage />} />
```

### Sidebar atualizado em `SuperAdminLayout.tsx`:
- Adicionar item "Permissões e Módulos" no grupo "Automação e Serviços" com ícone `Shield`
- Adicionar item "Agentes Digitais" com ícone `Bot` (página placeholder)
- Filtrar itens do sidebar: chamar `useSAPermissions()` e ocultar itens onde `canView === false`
- Dashboard sempre visível (não filtrável)
- `pageTitles` atualizado com as novas rotas

## 6 — Proteção de Rotas

No `SuperAdminLayout.tsx`, antes de renderizar `<Outlet />`:
- Verificar se o usuário tem `can_view` para o módulo correspondente à rota atual
- Se não tiver permissão, redirecionar para `/admin` com toast de aviso
- Mapeamento rota → slug via constante `ROUTE_MODULE_MAP`

## 7 — Arquivos Modificados/Criados

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabelas + seed + RLS + função |
| `src/hooks/useSAPermissions.ts` | Criar |
| `src/services/saPermissionService.ts` | Criar |
| `src/pages/admin/AdminPermissoesPage.tsx` | Criar |
| `src/pages/admin/AdminAgentesDigitaisPage.tsx` | Criar (placeholder) |
| `src/components/SuperAdminLayout.tsx` | Modificar (sidebar dinâmico + proteção) |
| `src/App.tsx` | Adicionar 2 novas rotas |

## Notas Técnicas

- Não altera o sistema de permissões existente do tenant (`usePermissions`, `permission_profiles`)
- Sistema isolado para o painel Super Admin
- Escalável: adicionar novo módulo = INSERT na `sa_modules` + atribuir permissões
- Super admin "dono" (primeiro super_admin) tem acesso total independente de registros na tabela

