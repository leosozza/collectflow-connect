
-- 1) Tabela custom_fields
CREATE TABLE public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, field_key)
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage custom_fields"
ON public.custom_fields FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view custom_fields"
ON public.custom_fields FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- 2) Coluna custom_data em clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}'::jsonb;

-- 3) Tabela client_update_logs
CREATE TABLE public.client_update_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  updated_by UUID,
  source TEXT NOT NULL DEFAULT 'import',
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_update_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage client_update_logs"
ON public.client_update_logs FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view client_update_logs"
ON public.client_update_logs FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can insert client_update_logs"
ON public.client_update_logs FOR INSERT
WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX idx_client_update_logs_client_id ON public.client_update_logs(client_id);
CREATE INDEX idx_client_update_logs_tenant_id ON public.client_update_logs(tenant_id);
