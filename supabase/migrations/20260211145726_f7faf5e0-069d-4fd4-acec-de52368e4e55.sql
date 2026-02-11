
-- =============================================
-- ETAPA 1: Criar tabelas base
-- =============================================

-- Enum para roles de tenant
CREATE TYPE public.tenant_role AS ENUM ('super_admin', 'admin', 'operador');

-- Tabela de planos SaaS
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2),
  limits JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Planos acessíveis a todos autenticados (leitura)
CREATE POLICY "Authenticated users can view plans"
ON public.plans FOR SELECT TO authenticated
USING (true);

-- Somente super_admin pode gerenciar planos (via função criada abaixo)
-- Será adicionada após criar a função helper

-- Inserir planos iniciais
INSERT INTO public.plans (name, slug, price_monthly, limits) VALUES
('Starter', 'starter', 99.90, '{"max_users": 3, "max_clients": 500, "features": ["basic_reports", "manual_collection"]}'),
('Professional', 'professional', 299.90, '{"max_users": 10, "max_clients": 5000, "features": ["basic_reports", "manual_collection", "auto_collection", "whatsapp", "advanced_reports"]}'),
('Enterprise', 'enterprise', 799.90, '{"max_users": 50, "max_clients": 50000, "features": ["basic_reports", "manual_collection", "auto_collection", "whatsapp", "advanced_reports", "api_access", "white_label", "custom_integrations"]}');

-- Tabela de tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#F97316',
  plan_id UUID REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela tenant_users (roles por tenant - substitui profiles.role)
CREATE TABLE public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'operador',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ETAPA 2: Adicionar tenant_id nas tabelas existentes
-- =============================================

ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.clients ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.commission_grades ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Índices para performance
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX idx_commission_grades_tenant_id ON public.commission_grades(tenant_id);
CREATE INDEX idx_tenant_users_user_id ON public.tenant_users(user_id);
CREATE INDEX idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);

-- =============================================
-- ETAPA 2.5: Migrar dados existentes
-- =============================================

-- Criar tenant padrão com plano Professional
INSERT INTO public.tenants (id, name, slug, plan_id)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  'CollectFlow Default',
  'default',
  id
FROM public.plans WHERE slug = 'professional';

-- Associar todos os profiles existentes ao tenant padrão
UPDATE public.profiles SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.clients SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.commission_grades SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;

-- Migrar usuários existentes para tenant_users
-- Admins atuais viram super_admin, operadores mantém operador
INSERT INTO public.tenant_users (tenant_id, user_id, role)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  p.user_id,
  CASE WHEN p.role = 'admin' THEN 'super_admin'::tenant_role ELSE 'operador'::tenant_role END
FROM public.profiles p
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- =============================================
-- ETAPA 3: Funções helper e políticas RLS
-- =============================================

-- Função para obter tenant_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_users
  WHERE user_id = auth.uid() LIMIT 1
$$;

-- Função para verificar role no contexto do tenant
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id uuid, _role tenant_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para verificar se é super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id AND role = 'super_admin'::tenant_role
  )
$$;

-- Função para verificar se é admin ou super_admin no tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id 
      AND tenant_id = _tenant_id 
      AND role IN ('admin'::tenant_role, 'super_admin'::tenant_role)
  )
$$;

-- =============================================
-- RLS: tenant_users
-- =============================================

CREATE POLICY "Users can view own tenant memberships"
ON public.tenant_users FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage users"
ON public.tenant_users FOR INSERT TO authenticated
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant admins can update users"
ON public.tenant_users FOR UPDATE TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant admins can delete users"
ON public.tenant_users FOR DELETE TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- RLS: tenants
-- =============================================

CREATE POLICY "Users can view own tenant"
ON public.tenants FOR SELECT TO authenticated
USING (
  id = public.get_my_tenant_id()
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant admins can update own tenant"
ON public.tenants FOR UPDATE TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Super admins can insert tenants"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage plans"
ON public.plans FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- =============================================
-- RLS: Atualizar políticas existentes (clients)
-- =============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can insert any client" ON public.clients;
DROP POLICY IF EXISTS "Admins can update any client" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete any client" ON public.clients;
DROP POLICY IF EXISTS "Operators can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can delete own clients" ON public.clients;

-- Novas políticas baseadas em tenant
CREATE POLICY "Tenant users can view clients"
ON public.clients FOR SELECT TO authenticated
USING (
  tenant_id = public.get_my_tenant_id()
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant admins can insert clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_my_tenant_id()
);

CREATE POLICY "Tenant admins can update clients"
ON public.clients FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_my_tenant_id()
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant admins can delete clients"
ON public.clients FOR DELETE TO authenticated
USING (
  (tenant_id = public.get_my_tenant_id() AND public.is_tenant_admin(auth.uid(), tenant_id))
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- RLS: Atualizar políticas existentes (profiles)
-- =============================================

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Users can view tenant profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  tenant_id = public.get_my_tenant_id()
  OR auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Tenant admins can update profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant admins can delete profiles"
ON public.profiles FOR DELETE TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- RLS: Atualizar políticas existentes (commission_grades)
-- =============================================

DROP POLICY IF EXISTS "Admins can manage commission grades" ON public.commission_grades;
DROP POLICY IF EXISTS "Authenticated users can view commission grades" ON public.commission_grades;

CREATE POLICY "Tenant users can view commission grades"
ON public.commission_grades FOR SELECT TO authenticated
USING (
  tenant_id = public.get_my_tenant_id()
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant admins can manage commission grades"
ON public.commission_grades FOR ALL TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- Atualizar handle_new_user para incluir tenant_id
-- =============================================

-- Permitir que qualquer autenticado crie tenant durante onboarding
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (true);
