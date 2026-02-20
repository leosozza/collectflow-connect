
-- Create permission_profiles table
CREATE TABLE public.permission_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_role text NOT NULL DEFAULT 'operador',
  permissions jsonb NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant users can view permission_profiles"
  ON public.permission_profiles FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage permission_profiles"
  ON public.permission_profiles FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_permission_profiles_updated_at
  BEFORE UPDATE ON public.permission_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add permission_profile_id column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permission_profile_id uuid REFERENCES public.permission_profiles(id) ON DELETE SET NULL;

-- Function to seed default profiles for a tenant
CREATE OR REPLACE FUNCTION public.seed_default_permission_profiles(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _operador_perms jsonb := '{
    "dashboard": ["view_own"],
    "gamificacao": ["view"],
    "carteira": ["view"],
    "acordos": ["view", "create"],
    "relatorios": [],
    "analytics": ["view_own"],
    "automacao": [],
    "contact_center": ["view"],
    "telefonia": ["view"],
    "cadastros": [],
    "financeiro": [],
    "integracoes": [],
    "configuracoes": [],
    "central_empresa": [],
    "auditoria": []
  }'::jsonb;
  _supervisor_perms jsonb := '{
    "dashboard": ["view_all"],
    "gamificacao": ["view"],
    "carteira": ["view", "create", "import"],
    "acordos": ["view", "create", "approve"],
    "relatorios": ["view"],
    "analytics": ["view_all"],
    "automacao": [],
    "contact_center": ["view", "manage_admin"],
    "telefonia": ["view"],
    "cadastros": [],
    "financeiro": [],
    "integracoes": [],
    "configuracoes": [],
    "central_empresa": [],
    "auditoria": []
  }'::jsonb;
  _gerente_perms jsonb := '{
    "dashboard": ["view_all"],
    "gamificacao": ["view", "manage"],
    "carteira": ["view", "create", "import"],
    "acordos": ["view", "create", "approve"],
    "relatorios": ["view"],
    "analytics": ["view_all"],
    "automacao": [],
    "contact_center": [],
    "telefonia": [],
    "cadastros": [],
    "financeiro": ["view", "manage"],
    "integracoes": [],
    "configuracoes": [],
    "central_empresa": [],
    "auditoria": ["view"]
  }'::jsonb;
  _admin_perms jsonb := '{
    "dashboard": ["view_all"],
    "gamificacao": ["view", "manage"],
    "carteira": ["view", "create", "import", "delete"],
    "acordos": ["view", "create", "approve"],
    "relatorios": ["view"],
    "analytics": ["view_all"],
    "automacao": ["view", "manage"],
    "contact_center": ["view", "manage_admin"],
    "telefonia": ["view"],
    "cadastros": ["view", "manage"],
    "financeiro": ["view", "manage"],
    "integracoes": ["view", "manage"],
    "configuracoes": ["view", "manage"],
    "central_empresa": ["view", "manage"],
    "auditoria": ["view"]
  }'::jsonb;
BEGIN
  -- Only insert if no profiles exist for this tenant
  IF NOT EXISTS (SELECT 1 FROM public.permission_profiles WHERE tenant_id = _tenant_id) THEN
    INSERT INTO public.permission_profiles (tenant_id, name, base_role, permissions, is_default) VALUES
      (_tenant_id, 'Operador Padrão', 'operador', _operador_perms, true),
      (_tenant_id, 'Supervisor Padrão', 'supervisor', _supervisor_perms, true),
      (_tenant_id, 'Gerente Padrão', 'gerente', _gerente_perms, true),
      (_tenant_id, 'Admin Padrão', 'admin', _admin_perms, true);
  END IF;
END;
$$;

-- Seed profiles for all existing tenants
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_permission_profiles(r.id);
  END LOOP;
END;
$$;

-- RPC for getting my permission profile
CREATE OR REPLACE FUNCTION public.get_my_permission_profile()
RETURNS TABLE(id uuid, name text, base_role text, permissions jsonb, is_default boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.id, pp.name, pp.base_role, pp.permissions, pp.is_default
  FROM public.permission_profiles pp
  JOIN public.profiles p ON p.permission_profile_id = pp.id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;
