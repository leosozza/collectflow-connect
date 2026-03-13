
-- 1. Create sa_modules table
CREATE TABLE public.sa_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sidebar_group text NOT NULL,
  icon text,
  route_path text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sa_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sa_modules"
  ON public.sa_modules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can manage sa_modules"
  ON public.sa_modules FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 2. Create sa_user_permissions table
CREATE TABLE public.sa_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_slug text NOT NULL REFERENCES sa_modules(slug) ON DELETE CASCADE,
  can_view boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_slug)
);

ALTER TABLE public.sa_user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage sa_user_permissions"
  ON public.sa_user_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can read own sa_user_permissions"
  ON public.sa_user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. Security definer function
CREATE OR REPLACE FUNCTION public.get_my_sa_permissions()
RETURNS TABLE(module_slug text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.module_slug, p.can_view, p.can_create, p.can_edit, p.can_delete
  FROM public.sa_user_permissions p
  WHERE p.user_id = auth.uid()
$$;

-- 4. Seed modules
INSERT INTO public.sa_modules (name, slug, sidebar_group, icon, route_path, sort_order) VALUES
  ('Dashboard', 'dashboard', 'root', 'LayoutDashboard', '/admin', 0),
  ('Suporte', 'suporte', 'Operação', 'Headphones', '/admin/suporte', 1),
  ('Gestão de Equipes', 'gestao_equipes', 'Operação', 'Users', '/admin/equipes', 2),
  ('Treinamentos e Reuniões', 'treinamentos_reunioes', 'Operação', 'GraduationCap', '/admin/treinamentos', 3),
  ('Serviços e Tokens', 'servicos_tokens', 'Automação e Serviços', 'Package', '/admin/servicos', 4),
  ('Permissões e Módulos', 'permissoes_modulos', 'Automação e Serviços', 'Shield', '/admin/permissoes', 5),
  ('Agentes Digitais', 'agentes_digitais', 'Automação e Serviços', 'Bot', '/admin/agentes-digitais', 6),
  ('Integrações', 'integracoes', 'Automação e Serviços', 'Settings', '/admin/configuracoes', 7),
  ('Gestão de Inquilinos', 'gestao_inquilinos', 'Gestão de Clientes', 'Building2', '/admin/tenants', 8),
  ('Gestão Financeira', 'gestao_financeira', 'Administração', 'DollarSign', '/admin/financeiro', 9),
  ('Roadmap', 'roadmap', 'Configurações', 'Map', '/admin/roadmap', 10),
  ('Relatórios e Análises', 'relatorios', 'Automação e Serviços', 'BarChart3', '/admin/relatorios', 11);
