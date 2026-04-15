CREATE POLICY "Users can delete manual payments in their tenant"
  ON public.manual_payments FOR DELETE TO authenticated
  USING (tenant_id = (SELECT get_my_tenant_id()));