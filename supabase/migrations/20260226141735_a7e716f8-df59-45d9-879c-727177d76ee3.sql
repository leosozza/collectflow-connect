
-- Add columns for agreement approval workflow
ALTER TABLE public.agreements ADD COLUMN requires_approval boolean NOT NULL DEFAULT false;
ALTER TABLE public.agreements ADD COLUMN approval_reason text;

-- Update the seed_default_permission_profiles function to include new modules
CREATE OR REPLACE FUNCTION public.seed_default_permission_profiles(_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _operador_perms jsonb := '{
    "dashboard": ["view_own"],
    "gamificacao": ["view"],
    "carteira": ["view"],
    "acordos": ["view", "create"],
    "relatorios": [],
    "analytics": ["view_own"],
    "automacao": [],
    "contact_center": ["view"],
    "telefonia": ["view"],
    "cadastros": [],
    "financeiro": [],
    "integracoes": [],
    "configuracoes": [],
    "central_empresa": [],
    "auditoria": [],
    "liberacoes": ["view"],
    "agendados": ["view_own"]
  }'::jsonb;
  _supervisor_perms jsonb := '{
    "dashboard": ["view_all"],
    "gamificacao": ["view"],
    "carteira": ["view", "create", "import"],
    "acordos": ["view", "create", "approve"],
    "relatorios": ["view"],
    "analytics": ["view_all"],
    "automacao": [],
    "contact_center": ["view", "manage_admin"],
    "telefonia": ["view"],
    "cadastros": [],
    "financeiro": [],
    "integracoes": [],
    "configuracoes": [],
    "central_empresa": [],
    "auditoria": [],
    "liberacoes": ["view", "approve"],
    "agendados": ["view_own", "view_all"]
  }'::jsonb;
  _gerente_perms jsonb := '{
    "dashboard": ["view_all"],
    "gamificacao": ["view", "manage"],
    "carteira": ["view", "create", "import"],
    "acordos": ["view", "create", "approve"],
    "relatorios": ["view"],
    "analytics": ["view_all"],
    "automacao": [],
    "contact_center": [],
    "telefonia": [],
    "cadastros": [],
    "financeiro": ["view", "manage"],
    "integracoes": [],
    "configuracoes": [],
    "central_empresa": [],
    "auditoria": ["view"],
    "liberacoes": ["view", "approve"],
    "agendados": ["view_own", "view_all"]
  }'::jsonb;
  _admin_perms jsonb := '{
    "dashboard": ["view_all"],
    "gamificacao": ["view", "manage"],
    "carteira": ["view", "create", "import", "delete"],
    "acordos": ["view", "create", "approve"],
    "relatorios": ["view"],
    "analytics": ["view_all"],
    "automacao": ["view", "manage"],
    "contact_center": ["view", "manage_admin"],
    "telefonia": ["view"],
    "cadastros": ["view", "manage"],
    "financeiro": ["view", "manage"],
    "integracoes": ["view", "manage"],
    "configuracoes": ["view", "manage"],
    "central_empresa": ["view", "manage"],
    "auditoria": ["view"],
    "liberacoes": ["view", "approve"],
    "agendados": ["view_own", "view_all"]
  }'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.permission_profiles WHERE tenant_id = _tenant_id) THEN
    INSERT INTO public.permission_profiles (tenant_id, name, base_role, permissions, is_default) VALUES
      (_tenant_id, 'Operador Padrão', 'operador', _operador_perms, true),
      (_tenant_id, 'Supervisor Padrão', 'supervisor', _supervisor_perms, true),
      (_tenant_id, 'Gerente Padrão', 'gerente', _gerente_perms, true),
      (_tenant_id, 'Admin Padrão', 'admin', _admin_perms, true);
  END IF;
END;
$function$;

-- Update RLS policy so supervisor/gerente can also update agreements (for approval)
DROP POLICY IF EXISTS "Tenant admins can update agreements" ON public.agreements;
CREATE POLICY "Tenant users can update agreements"
ON public.agreements
FOR UPDATE
TO authenticated
USING (tenant_id = get_my_tenant_id());
