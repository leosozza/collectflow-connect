
-- 1. credores
CREATE TABLE public.credores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL,
  inscricao_estadual TEXT,
  contato_responsavel TEXT,
  email TEXT,
  telefone TEXT,
  cep TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT DEFAULT 'corrente',
  pix_chave TEXT,
  gateway_ativo TEXT,
  gateway_token TEXT,
  gateway_ambiente TEXT DEFAULT 'producao',
  gateway_status TEXT DEFAULT 'ativo',
  parcelas_min INTEGER DEFAULT 1,
  parcelas_max INTEGER DEFAULT 12,
  entrada_minima_valor NUMERIC DEFAULT 0,
  entrada_minima_tipo TEXT DEFAULT 'percent',
  desconto_maximo NUMERIC DEFAULT 0,
  juros_mes NUMERIC DEFAULT 0,
  multa NUMERIC DEFAULT 0,
  honorarios_grade JSONB DEFAULT '[]'::jsonb,
  template_acordo TEXT DEFAULT '',
  template_recibo TEXT DEFAULT '',
  template_quitacao TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage credores" ON public.credores FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view credores" ON public.credores FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE TRIGGER update_credores_updated_at BEFORE UPDATE ON public.credores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. equipes
CREATE TABLE public.equipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  lider_id UUID REFERENCES public.profiles(id),
  meta_mensal NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage equipes" ON public.equipes FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view equipes" ON public.equipes FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE TRIGGER update_equipes_updated_at BEFORE UPDATE ON public.equipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. equipe_membros
CREATE TABLE public.equipe_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipe_id UUID NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(equipe_id, profile_id)
);

ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage equipe_membros" ON public.equipe_membros FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view equipe_membros" ON public.equipe_membros FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- 4. tipos_devedor
CREATE TABLE public.tipos_devedor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_devedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage tipos_devedor" ON public.tipos_devedor FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view tipos_devedor" ON public.tipos_devedor FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- 5. tipos_divida
CREATE TABLE public.tipos_divida (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_divida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage tipos_divida" ON public.tipos_divida FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view tipos_divida" ON public.tipos_divida FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));
