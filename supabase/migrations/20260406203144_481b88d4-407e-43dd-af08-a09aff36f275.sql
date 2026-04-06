CREATE TABLE public.client_generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_cpf text NOT NULL,
  credor text,
  type text NOT NULL,
  template_source text NOT NULL,
  template_snapshot text NOT NULL,
  rendered_html text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation select" ON public.client_generated_documents
  FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant insert" ON public.client_generated_documents
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());