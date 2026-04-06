
-- Tabela de modelos de documentos por tenant
CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('acordo','recibo','quitacao','divida','notificacao')),
  name text NOT NULL,
  description text,
  content text NOT NULL,
  is_customized boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, type)
);

-- RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view own templates"
  ON public.document_templates FOR SELECT
  TO authenticated
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant admins can manage templates"
  ON public.document_templates FOR ALL
  TO authenticated
  USING (tenant_id = get_my_tenant_id() AND is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (tenant_id = get_my_tenant_id() AND is_tenant_admin(auth.uid(), tenant_id));

-- Trigger updated_at
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
