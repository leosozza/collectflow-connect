
-- Junction table: operator <-> whatsapp_instance (many-to-many)
CREATE TABLE public.operator_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(profile_id, instance_id)
);

-- Enable RLS
ALTER TABLE public.operator_instances ENABLE ROW LEVEL SECURITY;

-- Admins can manage operator-instance assignments
CREATE POLICY "Tenant admins can manage operator instances"
  ON public.operator_instances
  FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Users can view their own assignments
CREATE POLICY "Users can view own instance assignments"
  ON public.operator_instances
  FOR SELECT
  USING (profile_id = get_my_profile_id() OR tenant_id = get_my_tenant_id());
