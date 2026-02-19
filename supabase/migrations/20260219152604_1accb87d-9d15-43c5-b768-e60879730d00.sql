
-- Tabela de scripts de abordagem dinâmicos
CREATE TABLE IF NOT EXISTS public.scripts_abordagem (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credor_id uuid REFERENCES public.credores(id) ON DELETE CASCADE,
  tipo_devedor_id uuid REFERENCES public.tipos_devedor(id) ON DELETE SET NULL,
  canal text NOT NULL DEFAULT 'telefone',
  titulo text NOT NULL DEFAULT '',
  conteudo text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS scripts_abordagem_tenant_idx ON public.scripts_abordagem(tenant_id);
CREATE INDEX IF NOT EXISTS scripts_abordagem_credor_idx ON public.scripts_abordagem(credor_id);
CREATE INDEX IF NOT EXISTS scripts_abordagem_tipo_devedor_idx ON public.scripts_abordagem(tipo_devedor_id);

-- Enable RLS
ALTER TABLE public.scripts_abordagem ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Tenant admins can manage scripts_abordagem"
  ON public.scripts_abordagem
  FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Users can view
CREATE POLICY "Tenant users can view scripts_abordagem"
  ON public.scripts_abordagem
  FOR SELECT
  USING ((tenant_id = get_my_tenant_id()) OR is_super_admin(auth.uid()));

-- Auto-update trigger
CREATE TRIGGER update_scripts_abordagem_updated_at
  BEFORE UPDATE ON public.scripts_abordagem
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
