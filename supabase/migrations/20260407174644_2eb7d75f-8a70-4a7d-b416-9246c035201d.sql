
CREATE OR REPLACE FUNCTION public.ingest_channel_event(
  _tenant_id uuid,
  _endpoint_id uuid,
  _channel_type text DEFAULT 'whatsapp',
  _provider text DEFAULT NULL,
  _remote_phone text DEFAULT NULL,
  _remote_name text DEFAULT NULL,
  _direction text DEFAULT 'inbound',
  _message_type text DEFAULT 'text',
  _content text DEFAULT NULL,
  _media_url text DEFAULT NULL,
  _media_mime_type text DEFAULT NULL,
  _external_id text DEFAULT NULL,
  _provider_message_id text DEFAULT NULL,
  _actor_type text DEFAULT 'human',
  _status text DEFAULT 'sent'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _conv_id uuid;
  _msg_id uuid;
  _client_id uuid;
  _client_cpf text;
  _is_new_conv boolean := false;
  _skipped_dup boolean := false;
  _conv_status text;
  _existing_client_id uuid;
  _unread int;
  _sla_minutes int;
  _sla_deadline timestamptz;
  _assigned_to uuid;
  _clean_phone text;
  _now timestamptz := now();
BEGIN
  -- Normalize phone
  _clean_phone := regexp_replace(COALESCE(_remote_phone, ''), '\D', '', 'g');
  
  IF _clean_phone = '' OR _clean_phone IS NULL THEN
    RETURN jsonb_build_object('error', 'remote_phone is required');
  END IF;

  -- 1. Resolve client via client_phones (Phase 2 RPC)
  SELECT cp.client_id, cp.cpf
  INTO _client_id, _client_cpf
  FROM public.client_phones cp
  WHERE cp.tenant_id = _tenant_id
    AND (cp.phone_e164 = normalize_phone_br(_remote_phone) OR cp.phone_last8 = RIGHT(_clean_phone, 8))
  ORDER BY 
    CASE WHEN cp.phone_e164 = normalize_phone_br(_remote_phone) THEN 0 ELSE 1 END,
    cp.priority ASC
  LIMIT 1;

  -- 2. Find or create conversation
  SELECT id, status, unread_count, client_id, assigned_to
  INTO _conv_id, _conv_status, _unread, _existing_client_id, _assigned_to
  FROM public.conversations
  WHERE tenant_id = _tenant_id
    AND endpoint_id = _endpoint_id
    AND remote_phone = _clean_phone
  LIMIT 1;

  -- Fallback: try instance_id match (legacy data before endpoint_id was populated)
  IF _conv_id IS NULL THEN
    SELECT id, status, unread_count, client_id, assigned_to
    INTO _conv_id, _conv_status, _unread, _existing_client_id, _assigned_to
    FROM public.conversations
    WHERE tenant_id = _tenant_id
      AND instance_id = _endpoint_id
      AND remote_phone = _clean_phone
    LIMIT 1;
  END IF;

  IF _conv_id IS NOT NULL THEN
    -- Existing conversation
    _is_new_conv := false;
    
    -- Use resolved client if conversation doesn't have one
    IF _existing_client_id IS NOT NULL THEN
      _client_id := COALESCE(_client_id, _existing_client_id);
    END IF;

    -- Status flow for inbound: closed → waiting
    IF _direction = 'inbound' THEN
      IF _conv_status = 'closed' THEN
        _conv_status := 'waiting';
      END IF;
      _unread := COALESCE(_unread, 0) + 1;
    END IF;

    -- Calculate SLA for inbound
    IF _direction = 'inbound' THEN
      _sla_minutes := 30; -- default
      -- Try credor-specific SLA
      IF _client_id IS NOT NULL THEN
        SELECT cr.sla_hours * 60 INTO _sla_minutes
        FROM public.clients cl
        JOIN public.credores cr ON cr.tenant_id = _tenant_id AND cr.razao_social = cl.credor
        WHERE cl.id = _client_id AND cr.sla_hours IS NOT NULL
        LIMIT 1;
      END IF;
      -- Fallback to tenant global
      IF _sla_minutes IS NULL OR _sla_minutes = 0 THEN
        SELECT COALESCE((t.settings->>'sla_minutes')::int, 30) INTO _sla_minutes
        FROM public.tenants t WHERE t.id = _tenant_id;
        _sla_minutes := COALESCE(_sla_minutes, 30);
      END IF;
      _sla_deadline := _now + (_sla_minutes * interval '1 minute');
    END IF;

    -- Update conversation
    UPDATE public.conversations SET
      status = COALESCE(_conv_status, status),
      unread_count = CASE WHEN _direction = 'inbound' THEN _unread ELSE unread_count END,
      last_message_at = _now,
      remote_name = CASE WHEN _direction = 'inbound' AND _remote_name IS NOT NULL AND _remote_name <> '' THEN _remote_name ELSE remote_name END,
      client_id = COALESCE(client_id, _client_id),
      sla_deadline_at = CASE WHEN _direction = 'inbound' THEN _sla_deadline ELSE NULL END,
      sla_notified_at = CASE WHEN _direction = 'inbound' THEN NULL ELSE sla_notified_at END,
      updated_at = _now
    WHERE id = _conv_id;

  ELSE
    -- New conversation
    _is_new_conv := true;

    -- Round-robin assignment for inbound
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

    -- SLA for new inbound
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
      _tenant_id, _endpoint_id, _endpoint_id, _clean_phone,
      COALESCE(_remote_name, _clean_phone),
      CASE WHEN _direction = 'inbound' THEN 'waiting' ELSE 'open' END,
      CASE WHEN _direction = 'inbound' THEN 1 ELSE 0 END,
      _now, _assigned_to, _client_id,
      _channel_type, _provider, _sla_deadline,
      _now, _now
    )
    RETURNING id INTO _conv_id;
  END IF;

  -- 3. Deduplicate by external_id
  IF _external_id IS NOT NULL AND _external_id <> '' THEN
    PERFORM 1 FROM public.chat_messages
    WHERE tenant_id = _tenant_id AND external_id = _external_id
    LIMIT 1;
    IF FOUND THEN
      _skipped_dup := true;
      RETURN jsonb_build_object(
        'conversation_id', _conv_id,
        'message_id', NULL,
        'is_new_conversation', _is_new_conv,
        'client_id', _client_id,
        'skipped_duplicate', true
      );
    END IF;
  END IF;

  -- 4. Insert message
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

  -- Note: last_message_* denormalization is handled by the trg_denormalize_last_message trigger

  RETURN jsonb_build_object(
    'conversation_id', _conv_id,
    'message_id', _msg_id,
    'is_new_conversation', _is_new_conv,
    'client_id', _client_id,
    'skipped_duplicate', false
  );
END;
$$;
