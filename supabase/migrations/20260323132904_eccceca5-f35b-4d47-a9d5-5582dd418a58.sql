
-- 1. Add new columns to system_modules
ALTER TABLE public.system_modules ADD COLUMN IF NOT EXISTS parent_slug text;
ALTER TABLE public.system_modules ADD COLUMN IF NOT EXISTS depends_on text[] DEFAULT '{}';

-- 2. Rename crm_core → crm
UPDATE public.system_modules SET slug = 'crm', name = 'CRM' WHERE slug = 'crm_core';

-- 3. Mark absorbed modules as is_core (always available, hidden from management)
UPDATE public.system_modules SET is_core = true WHERE slug IN ('automacao', 'relatorios', 'financeiro', 'integracoes', 'api_publica', 'portal_devedor', 'ia_negociacao');

-- 4. Set parent_slug and depends_on for existing modules
UPDATE public.system_modules SET depends_on = '{crm}' WHERE slug = 'contact_center';
UPDATE public.system_modules SET parent_slug = 'contact_center', depends_on = '{contact_center}' WHERE slug = 'whatsapp';
UPDATE public.system_modules SET parent_slug = 'contact_center', depends_on = '{contact_center}' WHERE slug = 'telefonia';
UPDATE public.system_modules SET depends_on = '{crm}' WHERE slug = 'gamificacao';

-- 5. Insert new IA modules
INSERT INTO public.system_modules (slug, name, description, category, icon, is_core, sort_order, parent_slug, depends_on) VALUES
  ('ia_negociacao_whatsapp', 'IA Negociação WhatsApp', 'Agente de IA para negociação automatizada via WhatsApp', 'ia', 'Bot', false, 20, NULL, '{crm,contact_center,whatsapp}'),
  ('ia_negociacao_telefonia', 'IA Negociação Telefonia', 'Agente de IA para negociação automatizada via telefonia', 'ia', 'Bot', false, 21, NULL, '{crm,contact_center,telefonia}')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  depends_on = EXCLUDED.depends_on,
  parent_slug = EXCLUDED.parent_slug,
  sort_order = EXCLUDED.sort_order;

-- 6. Update sort_order for hierarchy clarity
UPDATE public.system_modules SET sort_order = 1 WHERE slug = 'crm';
UPDATE public.system_modules SET sort_order = 10 WHERE slug = 'contact_center';
UPDATE public.system_modules SET sort_order = 11 WHERE slug = 'whatsapp';
UPDATE public.system_modules SET sort_order = 12 WHERE slug = 'telefonia';
UPDATE public.system_modules SET sort_order = 15 WHERE slug = 'gamificacao';
UPDATE public.system_modules SET sort_order = 20 WHERE slug = 'ia_negociacao_whatsapp';
UPDATE public.system_modules SET sort_order = 21 WHERE slug = 'ia_negociacao_telefonia';

-- 7. Update get_my_enabled_modules RPC to handle renamed slug
CREATE OR REPLACE FUNCTION public.get_my_enabled_modules()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT slug), ARRAY[]::TEXT[]) FROM (
    SELECT sm.slug FROM tenant_modules tm
    JOIN system_modules sm ON sm.id = tm.module_id
    WHERE tm.tenant_id = get_my_tenant_id() AND tm.enabled = true
    UNION ALL
    SELECT slug FROM system_modules WHERE is_core = true
  ) sub;
$function$;

-- 8. Update onboard_tenant to use new slug and structure
CREATE OR REPLACE FUNCTION public.onboard_tenant(_name text, _slug text, _plan_id uuid, _cnpj text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'Usuário já possui uma empresa';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = _slug) THEN
    RAISE EXCEPTION 'Identificador já está em uso';
  END IF;

  -- Seed system_modules if empty
  INSERT INTO public.system_modules (slug, name, description, category, icon, is_core, sort_order, parent_slug, depends_on) VALUES
    ('crm','CRM','Módulo principal de cobrança e gestão de carteira','core','LayoutDashboard',true,1,NULL,'{}'),
    ('contact_center','Contact Center','Central de atendimento multicanal','comunicacao','Headphones',false,10,NULL,'{crm}'),
    ('whatsapp','WhatsApp','Atendimento e disparo via WhatsApp','comunicacao','MessageCircle',false,11,'contact_center','{contact_center}'),
    ('telefonia','Telefonia','Discador e gestão de chamadas','comunicacao','Phone',false,12,'contact_center','{contact_center}'),
    ('automacao','Automação','Réguas de cobrança e workflows','produtividade','Zap',true,30,NULL,'{}'),
    ('portal_devedor','Portal do Devedor','Portal de autonegociação para devedores','negociacao','Globe',true,31,NULL,'{}'),
    ('relatorios','Relatórios','Relatórios operacionais e gerenciais','analytics','BarChart3',true,32,NULL,'{}'),
    ('gamificacao','Gamificação','Sistema de metas, ranking e recompensas','engajamento','Trophy',false,15,NULL,'{crm}'),
    ('financeiro','Financeiro','Controle financeiro e comissões','financeiro','DollarSign',true,33,NULL,'{}'),
    ('integracoes','Integrações','Integrações com sistemas externos','tecnico','Plug',true,34,NULL,'{}'),
    ('api_publica','API Pública','Acesso à API REST da plataforma','tecnico','Code',true,35,NULL,'{}'),
    ('ia_negociacao','IA Negociação','Inteligência artificial para negociação','ia','Bot',true,36,NULL,'{}'),
    ('ia_negociacao_whatsapp','IA Negociação WhatsApp','Agente de IA para negociação via WhatsApp','ia','Bot',false,20,NULL,'{crm,contact_center,whatsapp}'),
    ('ia_negociacao_telefonia','IA Negociação Telefonia','Agente de IA para negociação via telefonia','ia','Bot',false,21,NULL,'{crm,contact_center,telefonia}')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO public.tenants (name, slug, plan_id, cnpj, status)
  VALUES (_name, _slug, _plan_id, _cnpj, 'active')
  RETURNING id INTO _tenant_id;

  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (_tenant_id, _user_id, 'admin');

  UPDATE public.profiles
  SET tenant_id = _tenant_id, role = 'admin'
  WHERE user_id = _user_id;

  INSERT INTO public.tenant_modules (tenant_id, module_id, enabled, enabled_at)
  SELECT _tenant_id, sm.id, true, now()
  FROM public.system_modules sm
  WHERE sm.is_core = false
  ON CONFLICT (tenant_id, module_id) DO NOTHING;

  INSERT INTO public.tenant_tokens (tenant_id, token_balance, lifetime_purchased, updated_at)
  VALUES (_tenant_id, 50, 50, now());

  INSERT INTO public.token_transactions (tenant_id, transaction_type, amount, balance_after, description, created_by)
  VALUES (_tenant_id, 'credit', 50, 50, 'Saldo inicial de boas-vindas', _user_id);

  RETURN _tenant_id;
END;
$function$;
