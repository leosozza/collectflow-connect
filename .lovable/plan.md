

# Plano: Sistema de Liberação de Módulos por Tenant

## Resumo

Criar tabelas `system_modules` e `tenant_modules`, service, hook, componente ModuleGuard, e nova aba "Módulos" na Gestão de Tenants do Super Admin. O sistema de permissões de usuários permanece intocado -- módulos controlam o que o **tenant** pode acessar.

## 1. Database (Migration)

```sql
-- system_modules
CREATE TABLE public.system_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'addon',
  icon TEXT,
  is_core BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read system_modules" ON public.system_modules FOR SELECT TO authenticated USING (true);

-- tenant_modules
CREATE TABLE public.tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  module_id UUID REFERENCES public.system_modules(id) ON DELETE CASCADE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  enabled_at TIMESTAMPTZ DEFAULT now(),
  enabled_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, module_id)
);
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage tenant_modules" ON public.tenant_modules FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant users read own modules" ON public.tenant_modules FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id());

-- RPC for tenant-side fast check
CREATE FUNCTION public.get_my_enabled_modules()
RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT array_agg(DISTINCT slug) FROM (
    SELECT sm.slug FROM tenant_modules tm
    JOIN system_modules sm ON sm.id = tm.module_id
    WHERE tm.tenant_id = get_my_tenant_id() AND tm.enabled = true
    UNION ALL
    SELECT slug FROM system_modules WHERE is_core = true
  ) sub;
$$;
```

## 2. Seed dos 12 modulos (Insert tool)

INSERT dos modulos: `crm_core` (is_core=true), `contact_center`, `whatsapp`, `telefonia`, `automacao`, `portal_devedor`, `relatorios`, `gamificacao`, `financeiro`, `integracoes`, `api_publica`, `ia_negociacao`.

## 3. Novos arquivos

### `src/services/moduleService.ts`
- `getSystemModules()` -- busca todos os modulos
- `getTenantModules(tenantId)` -- busca modulos de um tenant com join em system_modules
- `toggleModule(tenantId, moduleId, enabled)` -- upsert em tenant_modules
- `bulkToggleModules(tenantIds[], moduleIds[], enabled)` -- loop de upserts

### `src/hooks/useModules.ts`
- Usa React Query para chamar `get_my_enabled_modules()` RPC
- Expõe `isModuleEnabled(slug)` -- super_admin sempre retorna true
- Cache de 5min (staleTime)

### `src/components/ModuleGuard.tsx`
- Props: `module: string`, `children`
- Se modulo desabilitado, renderiza card "Módulo não disponível para sua empresa"
- Super admin bypassa

### `src/components/admin/TenantModulesTab.tsx`
- Tabela com todos os modulos do sistema
- Toggle ativar/desativar por tenant
- Modulos core ficam sempre ligados (toggle disabled)
- Recebe `tenantId` como prop

### `src/components/admin/BulkModulesDialog.tsx`
- Dialog com 3 passos: selecionar tenants (multi-select), selecionar modulos (multi-select), escolher ação (ativar/desativar)
- Executa `bulkToggleModules`

## 4. Arquivos modificados

### `src/pages/SuperAdminPage.tsx`
- Adicionar aba "Módulos" no TabsList (ao lado de Resumo/Empresas/Serviços/Novo)
- TabsContent "modulos" renderiza seletor de tenant + `TenantModulesTab`
- Botão "Liberar em massa" abre `BulkModulesDialog`

### `src/components/AppLayout.tsx`
- Importar `useModules` hook
- Cada item do sidebar verifica `isModuleEnabled(slug)` antes de renderizar
- Mapeamento: gamificacao→`gamificacao`, automacao→`automacao`, contact_center→`whatsapp`/`telefonia`, relatorios→`relatorios`, integracoes→`integracoes`, financeiro→`financeiro`

### `src/App.tsx`
- Envolver rotas de modulos não-core com `<ModuleGuard module="slug">`
- Rotas afetadas: `/gamificacao`, `/automacao`, `/contact-center/*`, `/relatorios`, `/integracao`, `/financeiro`

## 5. Fluxo de acesso

```text
Rota → ProtectedRoute (auth) → ModuleGuard (módulo habilitado?) → usePermissions (permissão do usuário?) → Página
```

Modulos e permissões são camadas independentes. Módulos nao alteram o `usePermissions`.

## Ordem de execução

1. Migration (tabelas + RLS + RPC)
2. Seed dos 12 modulos
3. `moduleService.ts` + `useModules.ts` + `ModuleGuard.tsx`
4. `TenantModulesTab.tsx` + `BulkModulesDialog.tsx`
5. Modificar `SuperAdminPage.tsx` (nova aba)
6. Modificar `AppLayout.tsx` (sidebar filtering)
7. Modificar `App.tsx` (ModuleGuard nas rotas)

