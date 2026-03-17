
-- Table for configuring which fields are visible in /atendimento expansion
CREATE TABLE public.atendimento_field_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE(tenant_id, field_key)
);

ALTER TABLE public.atendimento_field_config ENABLE ROW LEVEL SECURITY;

-- All tenant members can read
CREATE POLICY "Tenant members can read field config"
ON public.atendimento_field_config
FOR SELECT
TO authenticated
USING (tenant_id = (SELECT get_my_tenant_id()));

-- Only admins can manage
CREATE POLICY "Admins can insert field config"
ON public.atendimento_field_config
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (SELECT get_my_tenant_id())
  AND is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Admins can update field config"
ON public.atendimento_field_config
FOR UPDATE
TO authenticated
USING (
  tenant_id = (SELECT get_my_tenant_id())
  AND is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Admins can delete field config"
ON public.atendimento_field_config
FOR DELETE
TO authenticated
USING (
  tenant_id = (SELECT get_my_tenant_id())
  AND is_tenant_admin(auth.uid(), tenant_id)
);

CREATE INDEX idx_atendimento_field_config_tenant ON public.atendimento_field_config(tenant_id);
