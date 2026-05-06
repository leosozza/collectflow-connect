-- Enrich client_events from chat_messages with campaign/source context
CREATE OR REPLACE FUNCTION public.trg_client_event_from_chat_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _conv record;
  _src text;
  _source_type text;
  _meta jsonb;
BEGIN
  SELECT c.tenant_id, c.client_id, cl.cpf AS client_cpf
  INTO _conv
  FROM public.conversations c
  LEFT JOIN public.clients cl ON cl.id = c.client_id
  WHERE c.id = NEW.conversation_id;

  IF _conv IS NULL OR _conv.client_cpf IS NULL THEN
    RETURN NEW;
  END IF;

  _source_type := COALESCE(NEW.metadata->>'source_type', '');

  -- Decide event_source
  IF _source_type = 'campaign' THEN
    _src := 'campaign';
  ELSIF _source_type IN ('workflow','prevention','regua') THEN
    _src := _source_type;
  ELSIF NEW.is_internal THEN
    _src := 'operator';
  ELSE
    _src := 'system';
  END IF;

  _meta := jsonb_build_object(
    'direction', NEW.direction,
    'status', NEW.status
  );

  IF _source_type <> '' THEN
    _meta := _meta || jsonb_build_object('source_type', _source_type);
  END IF;
  IF NEW.metadata ? 'campaign_id' THEN
    _meta := _meta || jsonb_build_object('campaign_id', NEW.metadata->>'campaign_id');
  END IF;
  IF NEW.metadata ? 'instance_id' THEN
    _meta := _meta || jsonb_build_object('instance_id', NEW.metadata->>'instance_id');
  END IF;
  IF NEW.metadata ? 'instance_name' THEN
    _meta := _meta || jsonb_build_object('instance_name', NEW.metadata->>'instance_name');
  END IF;
  IF NEW.metadata ? 'provider' THEN
    _meta := _meta || jsonb_build_object('provider', NEW.metadata->>'provider');
  END IF;

  INSERT INTO public.client_events (tenant_id, client_id, client_cpf, event_type, event_source, event_channel, event_value, metadata, created_at)
  VALUES (
    _conv.tenant_id,
    _conv.client_id,
    _conv.client_cpf,
    CASE WHEN NEW.direction = 'inbound' THEN 'whatsapp_inbound' ELSE 'whatsapp_outbound' END,
    _src,
    'whatsapp',
    NEW.message_type,
    _meta,
    NEW.created_at
  );

  RETURN NEW;
END;
$$;