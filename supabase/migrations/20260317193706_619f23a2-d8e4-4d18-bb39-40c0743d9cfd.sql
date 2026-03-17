
CREATE TABLE public.debtor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credor_id UUID NOT NULL REFERENCES public.credores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#6B7280',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(credor_id, nome)
);

ALTER TABLE public.debtor_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.debtor_categories
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

ALTER TABLE public.clients ADD COLUMN debtor_category_id UUID REFERENCES public.debtor_categories(id) ON DELETE SET NULL;
