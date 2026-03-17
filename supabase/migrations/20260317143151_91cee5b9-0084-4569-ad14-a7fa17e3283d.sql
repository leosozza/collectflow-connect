
CREATE TABLE public.call_disposition_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  group_name text NOT NULL DEFAULT 'resultado',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_call_disposition_types_tenant_key ON public.call_disposition_types(tenant_id, key);

ALTER TABLE public.call_disposition_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their disposition types"
ON public.call_disposition_types FOR SELECT
TO authenticated
USING (tenant_id = (SELECT get_my_tenant_id()));

CREATE POLICY "Tenant admins can insert disposition types"
ON public.call_disposition_types FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (SELECT get_my_tenant_id())
  AND is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Tenant admins can update disposition types"
ON public.call_disposition_types FOR UPDATE
TO authenticated
USING (
  tenant_id = (SELECT get_my_tenant_id())
  AND is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Tenant admins can delete disposition types"
ON public.call_disposition_types FOR DELETE
TO authenticated
USING (
  tenant_id = (SELECT get_my_tenant_id())
  AND is_tenant_admin(auth.uid(), tenant_id)
);
