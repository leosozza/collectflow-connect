
CREATE TABLE protest_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid REFERENCES clients(id),
  cpf text NOT NULL,
  nome_devedor text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  numero_titulo text,
  credor text NOT NULL,
  especie text DEFAULT 'DM',
  status text NOT NULL DEFAULT 'pending',
  cenprot_protocol text,
  cartorio text,
  sent_at timestamptz,
  protested_at timestamptz,
  cancelled_at timestamptz,
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE protest_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage protest titles"
  ON protest_titles FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view protest titles"
  ON protest_titles FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE TRIGGER update_protest_titles_updated_at
  BEFORE UPDATE ON protest_titles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE protest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  protest_title_id uuid REFERENCES protest_titles(id),
  action text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  message text,
  details jsonb DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE protest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage protest logs"
  ON protest_logs FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view protest logs"
  ON protest_logs FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));
