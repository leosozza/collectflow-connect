
-- Serasa negativation records
CREATE TABLE public.serasa_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid REFERENCES clients(id),
  cpf text NOT NULL,
  nome_devedor text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  numero_contrato text,
  credor text NOT NULL,
  natureza_operacao text DEFAULT 'COBRANCA',
  status text NOT NULL DEFAULT 'pending',
  serasa_protocol text,
  negativated_at timestamptz,
  removed_at timestamptz,
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.serasa_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage serasa records"
  ON public.serasa_records FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view serasa records"
  ON public.serasa_records FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE TRIGGER update_serasa_records_updated_at
  BEFORE UPDATE ON public.serasa_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Serasa operation logs
CREATE TABLE public.serasa_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  serasa_record_id uuid REFERENCES serasa_records(id),
  action text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  message text,
  details jsonb DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.serasa_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage serasa logs"
  ON public.serasa_logs FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view serasa logs"
  ON public.serasa_logs FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));
