CREATE OR REPLACE FUNCTION public.get_visible_conversations(
  _tenant_id uuid,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 30,
  _status_filter text DEFAULT NULL::text,
  _instance_filter uuid DEFAULT NULL::uuid,
  _operator_filter uuid DEFAULT NULL::uuid,
  _unread_only boolean DEFAULT false,
  _handler_filter text DEFAULT NULL::text,
  _search text DEFAULT NULL::text,
  _disposition_filter uuid DEFAULT NULL::uuid
)
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
    SELECT
      c.id AS conv_id,
      c.tenant_id AS conv_tenant_id,
      c.instance_id AS conv_instance_id,
      c.remote_phone AS conv_remote_phone,
      c.remote_name AS conv_remote_name,
      c.status AS conv_status,
      c.assigned_to AS conv_assigned_to,
      c.last_message_at AS conv_last_message_at,
      c.unread_count AS conv_unread_count,
      c.client_id AS conv_client_id,
      c.last_message_content AS conv_last_message_content,
      c.last_message_type AS conv_last_message_type,
      c.last_message_direction AS conv_last_message_direction,
      c.created_at AS conv_created_at,
      c.updated_at AS conv_updated_at,
      c.sla_deadline_at AS conv_sla_deadline_at
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
        OR (
              c.assigned_to IS NULL
              AND c.client_id IS NULL
              AND _profile_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM public.operator_instances oi
                WHERE oi.profile_id = _profile_id
                  AND oi.instance_id = COALESCE(c.endpoint_id, c.instance_id)
              )
            )
      )
  ),
  filtered AS (
    SELECT v.*
    FROM visible v
    WHERE (_status_filter IS NULL OR _status_filter = 'all' OR v.conv_status = _status_filter)
      AND (_instance_filter IS NULL OR v.conv_instance_id = _instance_filter)
      AND (_operator_filter IS NULL OR v.conv_assigned_to = _operator_filter)
      AND (NOT _unread_only OR v.conv_unread_count > 0)
      AND (
        _handler_filter IS NULL
        OR (_handler_filter = 'ai' AND v.conv_assigned_to IS NULL)
        OR (_handler_filter = 'human' AND v.conv_assigned_to IS NOT NULL)
      )
      AND (
        _disposition_filter IS NULL
        OR EXISTS (
          SELECT 1 FROM public.conversation_disposition_assignments cda
          WHERE cda.conversation_id = v.conv_id
            AND cda.disposition_type_id = _disposition_filter
        )
      )
      AND (
        _search IS NULL OR _search = ''
        OR v.conv_remote_name ILIKE '%' || _search || '%'
        OR v.conv_remote_phone ILIKE '%' || _search || '%'
      )
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER() AS conv_total_count
    FROM filtered f
  )
  SELECT
    cc.conv_id,
    cc.conv_tenant_id,
    cc.conv_instance_id,
    cc.conv_remote_phone,
    cc.conv_remote_name,
    cc.conv_status,
    cc.conv_assigned_to,
    cc.conv_last_message_at,
    cc.conv_unread_count,
    cc.conv_client_id,
    cl.nome_completo AS client_name,
    cc.conv_last_message_content,
    cc.conv_last_message_type,
    cc.conv_last_message_direction,
    cc.conv_created_at,
    cc.conv_updated_at,
    cc.conv_sla_deadline_at,
    cc.conv_total_count
  FROM counted cc
  LEFT JOIN public.clients cl ON cl.id = cc.conv_client_id
  ORDER BY cc.conv_last_message_at DESC NULLS LAST
  OFFSET _offset
  LIMIT _page_size;
END;
$function$;