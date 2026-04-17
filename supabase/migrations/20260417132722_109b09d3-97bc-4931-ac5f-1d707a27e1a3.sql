-- 1. Fix get_visible_conversations: assigned_to = _profile_id (not _user_id)
CREATE OR REPLACE FUNCTION public.get_visible_conversations(_tenant_id uuid, _page integer DEFAULT 1, _page_size integer DEFAULT 30, _status_filter text DEFAULT NULL::text, _instance_filter uuid DEFAULT NULL::uuid, _operator_filter uuid DEFAULT NULL::uuid, _unread_only boolean DEFAULT false, _handler_filter text DEFAULT NULL::text, _search text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, tenant_id uuid, instance_id uuid, remote_phone text, remote_name text, status text, assigned_to uuid, last_message_at timestamp with time zone, unread_count integer, client_id uuid, client_name text, last_message_content text, last_message_type text, last_message_direction text, created_at timestamp with time zone, updated_at timestamp with time zone, sla_deadline_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        OR (c.assigned_to IS NOT NULL AND _profile_id IS NOT NULL AND c.assigned_to = _profile_id)
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
$function$;

-- 2. New RPC: counts respecting visibility rules
CREATE OR REPLACE FUNCTION public.get_visible_conversation_counts(_tenant_id uuid)
 RETURNS TABLE(open_count bigint, waiting_count bigint, closed_count bigint, unread_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _user_role tenant_role;
  _profile_id uuid;
  _is_admin boolean := false;
  _open_statuses text[];
BEGIN
  IF _user_id IS NULL THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  SELECT tu.role INTO _user_role
  FROM public.tenant_users tu
  WHERE tu.user_id = _user_id AND tu.tenant_id = _tenant_id
  LIMIT 1;

  IF _user_role IS NULL THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint;
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
    SELECT c.status, c.unread_count
    FROM public.conversations c
    WHERE c.tenant_id = _tenant_id
      AND (
        _is_admin
        OR (c.assigned_to IS NOT NULL AND _profile_id IS NOT NULL AND c.assigned_to = _profile_id)
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
  )
  SELECT
    COUNT(*) FILTER (WHERE status = 'open')::bigint,
    COUNT(*) FILTER (WHERE status = 'waiting')::bigint,
    COUNT(*) FILTER (WHERE status = 'closed')::bigint,
    COUNT(*) FILTER (WHERE unread_count > 0)::bigint
  FROM visible;
END;
$function$;