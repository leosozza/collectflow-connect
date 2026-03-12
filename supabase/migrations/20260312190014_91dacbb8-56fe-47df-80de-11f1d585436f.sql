
CREATE TABLE public.client_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  phone_number text NOT NULL,
  phone_type text DEFAULT 'celular',
  priority integer DEFAULT 99,
  is_whatsapp boolean DEFAULT false,
  source text DEFAULT 'manual',
  raw_metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, cpf, phone_number)
);

ALTER TABLE public.client_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for client_phones" ON public.client_phones
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE INDEX idx_client_phones_tenant_cpf ON public.client_phones(tenant_id, cpf);
CREATE INDEX idx_client_phones_priority ON public.client_phones(tenant_id, cpf, priority);
