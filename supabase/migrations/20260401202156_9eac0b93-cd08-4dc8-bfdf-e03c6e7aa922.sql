
-- Drop the broken policy
DROP POLICY IF EXISTS "tenant_isolation" ON public.whatsapp_templates;

-- SELECT: users can only see templates from their own tenant
CREATE POLICY "whatsapp_templates_select" ON public.whatsapp_templates
  FOR SELECT TO authenticated
  USING (tenant_id = get_my_tenant_id());

-- INSERT: users can only create templates in their own tenant
CREATE POLICY "whatsapp_templates_insert" ON public.whatsapp_templates
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_my_tenant_id());

-- UPDATE: users can only edit templates in their own tenant
CREATE POLICY "whatsapp_templates_update" ON public.whatsapp_templates
  FOR UPDATE TO authenticated
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- DELETE: users can only delete templates in their own tenant
CREATE POLICY "whatsapp_templates_delete" ON public.whatsapp_templates
  FOR DELETE TO authenticated
  USING (tenant_id = get_my_tenant_id());
