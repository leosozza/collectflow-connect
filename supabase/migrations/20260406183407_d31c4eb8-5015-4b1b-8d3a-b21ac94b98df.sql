-- DROP existing restrictive policies
DROP POLICY IF EXISTS "Tenant admins can insert negociarie cobrancas" ON public.negociarie_cobrancas;
DROP POLICY IF EXISTS "Tenant admins can update negociarie cobrancas" ON public.negociarie_cobrancas;

-- Recreate with tenant-wide access
CREATE POLICY "Tenant users can insert negociarie cobrancas"
  ON public.negociarie_cobrancas FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can update negociarie cobrancas"
  ON public.negociarie_cobrancas FOR UPDATE
  USING (tenant_id = get_my_tenant_id());