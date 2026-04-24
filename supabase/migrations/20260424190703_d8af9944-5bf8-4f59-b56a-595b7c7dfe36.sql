-- =====================================================================
-- 1) Mesclar TODAS as conversas duplicadas por (tenant, instance, last8)
--    Esta etapa precisa rodar ANTES do backfill normalizador para
--    evitar colisão com o índice único existente
--    uq_conversations_tenant_instance_phone (tenant_id, instance_id, remote_phone)
-- =====================================================================
DO $$
DECLARE
  _grp record;
  _winner uuid;
  _losers uuid[];
BEGIN
  FOR _grp IN
    SELECT
      tenant_id,
      COALESCE(instance_id, endpoint_id) AS bucket_instance,
      RIGHT(regexp_replace(remote_phone, '\D', '', 'g'), 8) AS last8,
      array_agg(id ORDER BY last_message_at DESC NULLS LAST, created_at DESC) AS conv_ids
    FROM public.conversations
    WHERE remote_phone IS NOT NULL
      AND length(regexp_replace(remote_phone, '\D', '', 'g')) >= 8
      AND COALESCE(instance_id, endpoint_id) IS NOT NULL
    GROUP BY tenant_id, COALESCE(instance_id, endpoint_id), RIGHT(regexp_replace(remote_phone, '\D', '', 'g'), 8)
    HAVING COUNT(*) > 1
  LOOP
    _winner := _grp.conv_ids[1];
    _losers := _grp.conv_ids[2:array_length(_grp.conv_ids, 1)];

    UPDATE public.chat_messages
       SET conversation_id = _winner
     WHERE conversation_id = ANY(_losers);

    BEGIN
      UPDATE public.conversation_tag_assignments
         SET conversation_id = _winner
       WHERE conversation_id = ANY(_losers);
    EXCEPTION WHEN unique_violation THEN
      DELETE FROM public.conversation_tag_assignments WHERE conversation_id = ANY(_losers);
    END;

    BEGIN
      UPDATE public.conversation_disposition_assignments
         SET conversation_id = _winner
       WHERE conversation_id = ANY(_losers);
    EXCEPTION WHEN unique_violation THEN
      DELETE FROM public.conversation_disposition_assignments WHERE conversation_id = ANY(_losers);
    END;

    BEGIN
      UPDATE public.conversation_transfers
         SET conversation_id = _winner
       WHERE conversation_id = ANY(_losers);
    EXCEPTION WHEN unique_violation THEN
      DELETE FROM public.conversation_transfers WHERE conversation_id = ANY(_losers);
    END;

    DELETE FROM public.conversations WHERE id = ANY(_losers);
  END LOOP;
END $$;

-- =====================================================================
-- 2) Backfill: normalizar remote_phone das conversas remanescentes
--    Agora seguro: cada (tenant,instance,last8) tem 1 só linha
-- =====================================================================
UPDATE public.conversations
   SET remote_phone = public.normalize_phone_br(remote_phone),
       updated_at = now()
 WHERE public.normalize_phone_br(remote_phone) IS NOT NULL
   AND remote_phone <> public.normalize_phone_br(remote_phone);

-- =====================================================================
-- 3) Recalcular last_message_* a partir das mensagens reais
-- =====================================================================
UPDATE public.conversations c
   SET last_message_at = m.last_at,
       last_message_content = m.last_content,
       last_message_type = m.last_type,
       last_message_direction = m.last_direction,
       last_interaction_at = m.last_at,
       updated_at = now()
  FROM (
    SELECT DISTINCT ON (conversation_id)
      conversation_id,
      created_at AS last_at,
      content AS last_content,
      message_type AS last_type,
      direction AS last_direction
    FROM public.chat_messages
    ORDER BY conversation_id, created_at DESC
  ) m
 WHERE c.id = m.conversation_id;

-- =====================================================================
-- 4) Corrigir RPC ingest_channel_event
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ingest_channel_event(
  _tenant_id uuid,
  _endpoint_id uuid,
  _channel_type text DEFAULT 'whatsapp'::text,
  _provider text DEFAULT NULL::text,
  _remote_phone text DEFAULT NULL::text,
  _remote_name text DEFAULT NULL::text,
  _direction text DEFAULT 'inbound'::text,
  _message_type text DEFAULT 'text'::text,
  _content text DEFAULT NULL::text,
  _media_url text DEFAULT NULL::text,
  _media_mime_type text DEFAULT NULL::text,
  _external_id text DEFAULT NULL::text,
  _provider_message_id text DEFAULT NULL::text,
  _actor_type text DEFAULT 'human'::text,
  _status text DEFAULT 'sent'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _conv_id uuid;
  _msg_id uuid;
  _client_id uuid;
  _client_cpf text;
  _is_new_conv boolean := false;
  _conv_status text;
  _existing_client_id uuid;
  _unread int;
  _sla_minutes int;
  _sla_deadline timestamptz;
  _assigned_to uuid;
  _raw_digits text;
  _normalized_phone text;
  _phone_last8 text;
  _canonical_phone text;
  _now timestamptz := now();
BEGIN
  _raw_digits := regexp_replace(COALESCE(_remote_phone, ''), '\D', '', 'g');

  IF _raw_digits = '' OR _raw_digits IS NULL THEN
    RETURN jsonb_build_object('error', 'remote_phone is required');
  END IF;

  _normalized_phone := public.normalize_phone_br(_remote_phone);
  _canonical_phone := COALESCE(_normalized_phone, _raw_digits);
  _phone_last8 := RIGHT(_raw_digits, 8);

  -- Resolve client
  SELECT cp.client_id, cp.cpf
  INTO _client_id, _client_cpf
  FROM public.client_phones cp
  WHERE cp.tenant_id = _tenant_id
    AND (cp.phone_e164 = _canonical_phone OR cp.phone_last8 = _phone_last8)
  ORDER BY
    CASE WHEN cp.phone_e164 = _canonical_phone THEN 0 ELSE 1 END,
    cp.priority ASC
  LIMIT 1;

  -- Find conversation: canonical phone first
  SELECT id, status, unread_count, client_id, assigned_to
  INTO _conv_id, _conv_status, _unread, _existing_client_id, _assigned_to
  FROM public.conversations
  WHERE tenant_id = _tenant_id
    AND (endpoint_id = _endpoint_id OR instance_id = _endpoint_id)
    AND remote_phone = _canonical_phone
  ORDER BY last_message_at DESC NULLS LAST
  LIMIT 1;

  -- Fallback: by raw digits
  IF _conv_id IS NULL AND _raw_digits <> _canonical_phone THEN
    SELECT id, status, unread_count, client_id, assigned_to
    INTO _conv_id, _conv_status, _unread, _existing_client_id, _assigned_to
    FROM public.conversations
    WHERE tenant_id = _tenant_id
      AND (endpoint_id = _endpoint_id OR instance_id = _endpoint_id)
      AND remote_phone = _raw_digits
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- Fallback: by phone_last8 (catches any format)
  IF _conv_id IS NULL THEN
    SELECT id, status, unread_count, client_id, assigned_to
    INTO _conv_id, _conv_status, _unread, _existing_client_id, _assigned_to
    FROM public.conversations
    WHERE tenant_id = _tenant_id
      AND (endpoint_id = _endpoint_id OR instance_id = _endpoint_id)
      AND RIGHT(regexp_replace(remote_phone, '\D', '', 'g'), 8) = _phone_last8
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF _conv_id IS NOT NULL THEN
    _is_new_conv := false;

    IF _existing_client_id IS NOT NULL THEN
      _client_id := COALESCE(_client_id, _existing_client_id);
    END IF;

    IF _direction = 'inbound' THEN
      IF _conv_status = 'closed' THEN
        _conv_status := 'waiting';
      END IF;
      _unread := COALESCE(_unread, 0) + 1;
    END IF;

    IF _direction = 'inbound' THEN
      _sla_minutes := 30;
      IF _client_id IS NOT NULL THEN
        SELECT cr.sla_hours * 60 INTO _sla_minutes
        FROM public.clients cl
        JOIN public.credores cr ON cr.tenant_id = _tenant_id AND cr.razao_social = cl.credor
        WHERE cl.id = _client_id AND cr.sla_hours IS NOT NULL
        LIMIT 1;
      END IF;
      IF _sla_minutes IS NULL OR _sla_minutes = 0 THEN
        SELECT COALESCE((t.settings->>'sla_minutes')::int, 30) INTO _sla_minutes
        FROM public.tenants t WHERE t.id = _tenant_id;
        _sla_minutes := COALESCE(_sla_minutes, 30);
      END IF;
      _sla_deadline := _now + (_sla_minutes * interval '1 minute');
    END IF;

    UPDATE public.conversations SET
      status = COALESCE(_conv_status, status),
      unread_count = CASE WHEN _direction = 'inbound' THEN _unread ELSE unread_count END,
      last_message_at = _now,
      remote_phone = _canonical_phone,
      remote_name = CASE WHEN _direction = 'inbound' AND _remote_name IS NOT NULL AND _remote_name <> '' THEN _remote_name ELSE remote_name END,
      client_id = COALESCE(client_id, _client_id),
      sla_deadline_at = CASE WHEN _direction = 'inbound' THEN _sla_deadline ELSE NULL END,
      sla_notified_at = CASE WHEN _direction = 'inbound' THEN NULL ELSE sla_notified_at END,
      updated_at = _now
    WHERE id = _conv_id;

  ELSE
    _is_new_conv := true;

    IF _direction = 'inbound' THEN
      SELECT oi.profile_id INTO _assigned_to
      FROM public.operator_instances oi
      WHERE oi.instance_id = _endpoint_id AND oi.tenant_id = _tenant_id
      ORDER BY (
        SELECT COUNT(*) FROM public.conversations c
        WHERE c.assigned_to = oi.profile_id AND c.tenant_id = _tenant_id AND c.status = 'open'
      ) ASC
      LIMIT 1;
    END IF;

    _sla_minutes := 30;
    IF _direction = 'inbound' THEN
      IF _client_id IS NOT NULL THEN
        SELECT cr.sla_hours * 60 INTO _sla_minutes
        FROM public.clients cl
        JOIN public.credores cr ON cr.tenant_id = _tenant_id AND cr.razao_social = cl.credor
        WHERE cl.id = _client_id AND cr.sla_hours IS NOT NULL
        LIMIT 1;
      END IF;
      IF _sla_minutes IS NULL OR _sla_minutes = 0 THEN
        SELECT COALESCE((t.settings->>'sla_minutes')::int, 30) INTO _sla_minutes
        FROM public.tenants t WHERE t.id = _tenant_id;
        _sla_minutes := COALESCE(_sla_minutes, 30);
      END IF;
      _sla_deadline := _now + (_sla_minutes * interval '1 minute');
    END IF;

    INSERT INTO public.conversations (
      tenant_id, instance_id, endpoint_id, remote_phone, remote_name,
      status, unread_count, last_message_at, assigned_to, client_id,
      channel_type, provider, sla_deadline_at, created_at, updated_at
    ) VALUES (
      _tenant_id, _endpoint_id, _endpoint_id, _canonical_phone,
      COALESCE(_remote_name, _canonical_phone),
      CASE WHEN _direction = 'inbound' THEN 'waiting' ELSE 'open' END,
      CASE WHEN _direction = 'inbound' THEN 1 ELSE 0 END,
      _now, _assigned_to, _client_id,
      _channel_type, _provider, _sla_deadline,
      _now, _now
    )
    RETURNING id INTO _conv_id;
  END IF;

  -- Dedup by external_id
  IF _external_id IS NOT NULL AND _external_id <> '' THEN
    PERFORM 1 FROM public.chat_messages
    WHERE tenant_id = _tenant_id AND external_id = _external_id
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'conversation_id', _conv_id,
        'message_id', NULL,
        'is_new_conversation', _is_new_conv,
        'client_id', _client_id,
        'skipped_duplicate', true
      );
    END IF;
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id, tenant_id, direction, message_type, content,
    media_url, media_mime_type, status, external_id,
    provider, provider_message_id, endpoint_id, actor_type,
    is_internal, created_at
  ) VALUES (
    _conv_id, _tenant_id, _direction, _message_type, _content,
    _media_url, _media_mime_type, _status, _external_id,
    _provider, _provider_message_id, _endpoint_id, _actor_type,
    false, _now
  )
  RETURNING id INTO _msg_id;

  RETURN jsonb_build_object(
    'conversation_id', _conv_id,
    'message_id', _msg_id,
    'is_new_conversation', _is_new_conv,
    'client_id', _client_id,
    'skipped_duplicate', false
  );
END;
$function$;