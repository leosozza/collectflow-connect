-- ============================================
-- FASE 1: Visibilidade robusta de conversas WhatsApp
-- ============================================

-- 1. Tabela de transferências de conversa (criada já agora pois a função de visibilidade depende dela)
CREATE TABLE IF NOT EXISTS public.conversation_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_transfers_conv ON public.conversation_transfers(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_transfers_to_user ON public.conversation_transfers(to_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_conversation_transfers_tenant ON public.conversation_transfers(tenant_id);

ALTER TABLE public.conversation_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view transfers"
ON public.conversation_transfers FOR SELECT
USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "Tenant members can insert transfers"
ON public.conversation_transfers FOR INSERT
WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "Tenant admins can update transfers"
ON public.conversation_transfers FOR UPDATE
USING (tenant_id = public.get_my_tenant_id() AND public.is_tenant_admin(auth.uid(), tenant_id));

-- 2. Configurações de visibilidade por tenant (estende settings existente)
-- Garantia: tenants já tem coluna 'settings' jsonb. Apenas documentamos a estrutura aqui.
-- Estrutura esperada em tenants.settings:
-- {
--   "whatsapp_visibility": {
--     "open_statuses": ["acordo_vigente", "quitado"]  -- status do cliente que liberam visualização ampla
--   }
-- }

-- 3. Função SECURITY DEFINER que decide se um usuário pode ver uma conversa
CREATE OR REPLACE FUNCTION public.can_user_see_conversation(_user_id uuid, _conv_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _conv record;
  _user_tenant uuid;
  _user_role tenant_role;
  _profile_id uuid;
  _open_statuses text[];
  _client_status text;
BEGIN
  IF _user_id IS NULL OR _conv_id IS NULL THEN
    RETURN false;
  END IF;

  -- Carrega contexto do usuário
  SELECT tu.tenant_id, tu.role
  INTO _user_tenant, _user_role
  FROM public.tenant_users tu
  WHERE tu.user_id = _user_id
  LIMIT 1;

  IF _user_tenant IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO _profile_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;

  -- Carrega conversa
  SELECT c.id, c.tenant_id, c.assigned_to, c.client_id, c.status
  INTO _conv
  FROM public.conversations c
  WHERE c.id = _conv_id;

  IF _conv.id IS NULL OR _conv.tenant_id <> _user_tenant THEN
    RETURN false;
  END IF;

  -- Regra 1: Admin / super_admin do tenant veem tudo
  IF _user_role IN ('admin'::tenant_role, 'super_admin'::tenant_role) THEN
    RETURN true;
  END IF;

  -- Regra 2: Conversa atribuída ao usuário
  IF _conv.assigned_to IS NOT NULL AND _conv.assigned_to = _user_id THEN
    RETURN true;
  END IF;

  -- Regra 3: Cliente da conversa pertence à carteira do operador
  IF _profile_id IS NOT NULL AND _conv.client_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.id = _conv.client_id
        AND cl.operator_id = _profile_id
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Regra 4: Transferência ativa para o usuário
  IF EXISTS (
    SELECT 1 FROM public.conversation_transfers ct
    WHERE ct.conversation_id = _conv_id
      AND ct.to_user_id = _user_id
      AND ct.is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Regra 5: Status do cliente em lista de status "abertos" configurada pelo tenant
  IF _conv.client_id IS NOT NULL THEN
    SELECT COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(t.settings->'whatsapp_visibility'->'open_statuses')),
      ARRAY[]::text[]
    )
    INTO _open_statuses
    FROM public.tenants t
    WHERE t.id = _user_tenant;

    IF array_length(_open_statuses, 1) > 0 THEN
      SELECT cl.status::text INTO _client_status
      FROM public.clients cl
      WHERE cl.id = _conv.client_id;

      IF _client_status = ANY(_open_statuses) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- 4. RPC server-side para listar conversas visíveis (com filtros e paginação)
CREATE OR REPLACE FUNCTION public.get_visible_conversations(
  _tenant_id uuid,
  _page int DEFAULT 1,
  _page_size int DEFAULT 30,
  _status_filter text DEFAULT NULL,
  _instance_filter uuid DEFAULT NULL,
  _operator_filter uuid DEFAULT NULL,
  _unread_only boolean DEFAULT false,
  _handler_filter text DEFAULT NULL,
  _search text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  instance_id uuid,
  remote_phone text,
  remote_name text,
  status text,
  assigned_to uuid,
  last_message_at timestamptz,
  unread_count int,
  client_id uuid,
  client_name text,
  last_message_content text,
  last_message_type text,
  last_message_direction text,
  created_at timestamptz,
  updated_at timestamptz,
  sla_deadline_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_role tenant_role;
  _profile_id uuid;
  _is_admin boolean := false;
  _open_statuses text[];
  _offset int := (_page - 1) * _page_size;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  -- Verifica acesso ao tenant
  SELECT tu.role INTO _user_role
  FROM public.tenant_users tu
  WHERE tu.user_id = _user_id AND tu.tenant_id = _tenant_id
  LIMIT 1;

  IF _user_role IS NULL THEN
    RETURN;
  END IF;

  _is_admin := _user_role IN ('admin'::tenant_role, 'super_admin'::tenant_role);

  SELECT p.id INTO _profile_id FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1;

  SELECT COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(t.settings->'whatsapp_visibility'->'open_statuses')),
    ARRAY[]::text[]
  )
  INTO _open_statuses
  FROM public.tenants t WHERE t.id = _tenant_id;

  RETURN QUERY
  WITH visible AS (
    SELECT c.*
    FROM public.conversations c
    WHERE c.tenant_id = _tenant_id
      AND (
        _is_admin
        OR c.assigned_to = _user_id
        OR (c.client_id IS NOT NULL AND _profile_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.clients cl
              WHERE cl.id = c.client_id AND cl.operator_id = _profile_id
            ))
        OR EXISTS (
              SELECT 1 FROM public.conversation_transfers ct
              WHERE ct.conversation_id = c.id
                AND ct.to_user_id = _user_id
                AND ct.is_active = true
            )
        OR (
              array_length(_open_statuses, 1) > 0
              AND c.client_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM public.clients cl
                WHERE cl.id = c.client_id AND cl.status::text = ANY(_open_statuses)
              )
            )
      )
  ),
  filtered AS (
    SELECT v.*
    FROM visible v
    WHERE (_status_filter IS NULL OR _status_filter = 'all' OR v.status = _status_filter)
      AND (_instance_filter IS NULL OR v.instance_id = _instance_filter)
      AND (_operator_filter IS NULL OR v.assigned_to = _operator_filter)
      AND (NOT _unread_only OR v.unread_count > 0)
      AND (
        _handler_filter IS NULL
        OR (_handler_filter = 'ai' AND v.assigned_to IS NULL)
        OR (_handler_filter = 'human' AND v.assigned_to IS NOT NULL)
      )
      AND (
        _search IS NULL OR _search = ''
        OR v.remote_name ILIKE '%' || _search || '%'
        OR v.remote_phone ILIKE '%' || _search || '%'
      )
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER() AS total_count
    FROM filtered f
  )
  SELECT
    c.id,
    c.tenant_id,
    c.instance_id,
    c.remote_phone,
    c.remote_name,
    c.status,
    c.assigned_to,
    c.last_message_at,
    c.unread_count,
    c.client_id,
    cl.nome_completo AS client_name,
    c.last_message_content,
    c.last_message_type,
    c.last_message_direction,
    c.created_at,
    c.updated_at,
    c.sla_deadline_at,
    c.total_count
  FROM counted c
  LEFT JOIN public.clients cl ON cl.id = c.client_id
  ORDER BY c.last_message_at DESC NULLS LAST
  OFFSET _offset
  LIMIT _page_size;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.can_user_see_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_conversations(uuid, int, int, text, uuid, uuid, boolean, text, text) TO authenticated;