DROP POLICY IF EXISTS "Tenant admins can delete attachments" ON client_attachments;
CREATE POLICY "Tenant users can delete attachments" ON client_attachments
  FOR DELETE TO authenticated
  USING (tenant_id = get_my_tenant_id());