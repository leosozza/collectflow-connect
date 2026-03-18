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

  -- Seed system_modules if empty (ensures catalog exists)
  INSERT INTO public.system_modules (slug, name, description, category, icon, is_core, sort_order) VALUES
    ('crm_core','CRM Core','Módulo principal de cobrança e gestão de carteira','core','LayoutDashboard',true,1),
    ('contact_center','Contact Center','Central de atendimento multicanal','comunicacao','Headphones',false,2),
    ('whatsapp','WhatsApp','Atendimento e disparo via WhatsApp','comunicacao','MessageCircle',false,3),
    ('telefonia','Telefonia','Discador e gestão de chamadas','comunicacao','Phone',false,4),
    ('automacao','Automação','Réguas de cobrança e workflows','produtividade','Zap',false,5),
    ('portal_devedor','Portal do Devedor','Portal de autonegociação para devedores','negociacao','Globe',false,6),
    ('relatorios','Relatórios','Relatórios operacionais e gerenciais','analytics','BarChart3',false,7),
    ('gamificacao','Gamificação','Sistema de metas, ranking e recompensas','engajamento','Trophy',false,8),
    ('financeiro','Financeiro','Controle financeiro e comissões','financeiro','DollarSign',false,9),
    ('integracoes','Integrações','Integrações com sistemas externos','tecnico','Plug',false,10),
    ('api_publica','API Pública','Acesso à API REST da plataforma','tecnico','Code',false,11),
    ('ia_negociacao','IA Negociação','Inteligência artificial para negociação','ia','Bot',false,12)
  ON CONFLICT (slug) DO NOTHING;

  -- Create tenant
  INSERT INTO public.tenants (name, slug, plan_id, cnpj, status)
  VALUES (_name, _slug, _plan_id, _cnpj, 'active')
  RETURNING id INTO _tenant_id;

  -- Create tenant_user with admin role
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (_tenant_id, _user_id, 'admin');

  UPDATE public.profiles
  SET tenant_id = _tenant_id, role = 'admin'
  WHERE user_id = _user_id;

  -- Enable all non-core modules for new tenant
  INSERT INTO public.tenant_modules (tenant_id, module_id, enabled, enabled_at)
  SELECT _tenant_id, sm.id, true, now()
  FROM public.system_modules sm
  WHERE sm.is_core = false
  ON CONFLICT (tenant_id, module_id) DO NOTHING;

  -- Initialize token balance with welcome credit
  INSERT INTO public.tenant_tokens (tenant_id, token_balance, lifetime_purchased, updated_at)
  VALUES (_tenant_id, 50, 50, now());

  INSERT INTO public.token_transactions (tenant_id, transaction_type, amount, balance_after, description, created_by)
  VALUES (_tenant_id, 'credit', 50, 50, 'Saldo inicial de boas-vindas', _user_id);

  RETURN _tenant_id;
END;
$function$;