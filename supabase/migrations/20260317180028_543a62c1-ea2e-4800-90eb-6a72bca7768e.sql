
-- Add credor_id column
ALTER TABLE public.atendimento_field_config ADD COLUMN credor_id UUID REFERENCES public.credores(id) ON DELETE CASCADE;

-- Drop old unique constraint
ALTER TABLE public.atendimento_field_config DROP CONSTRAINT IF EXISTS atendimento_field_config_tenant_id_field_key_key;

-- Add new unique constraint on credor_id + field_key
ALTER TABLE public.atendimento_field_config ADD CONSTRAINT atendimento_field_config_credor_id_field_key_key UNIQUE(credor_id, field_key);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Tenant members can read field config" ON public.atendimento_field_config;
DROP POLICY IF EXISTS "Tenant admins can manage field config" ON public.atendimento_field_config;

-- New RLS policies using credor's tenant_id
CREATE POLICY "Tenant members can read field config"
ON public.atendimento_field_config FOR SELECT
TO authenticated
USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant admins can manage field config"
ON public.atendimento_field_config FOR ALL
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));
