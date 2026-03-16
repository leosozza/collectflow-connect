
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
CREATE OR REPLACE FUNCTION public.get_my_enabled_modules()
RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(DISTINCT slug), ARRAY[]::TEXT[]) FROM (
    SELECT sm.slug FROM tenant_modules tm
    JOIN system_modules sm ON sm.id = tm.module_id
    WHERE tm.tenant_id = get_my_tenant_id() AND tm.enabled = true
    UNION ALL
    SELECT slug FROM system_modules WHERE is_core = true
  ) sub;
$$;
