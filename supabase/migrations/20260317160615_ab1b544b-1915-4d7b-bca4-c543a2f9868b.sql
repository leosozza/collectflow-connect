
-- =============================================================
-- Score Operacional V1: client_events unified timeline table
-- =============================================================

CREATE TABLE public.client_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_cpf text NOT NULL,
  event_type text NOT NULL,
  event_source text NOT NULL,
  event_channel text,
  event_value text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_client_events" ON public.client_events FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_my_tenant_id()));
CREATE POLICY "tenant_insert_client_events" ON public.client_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_my_tenant_id()));

CREATE INDEX idx_client_events_cpf ON public.client_events (tenant_id, client_cpf, created_at DESC);
CREATE INDEX idx_client_events_client ON public.client_events (client_id, created_at DESC);

-- =============================================================
-- Trigger functions to auto-populate client_events
-- =============================================================

-- 1. call_dispositions → client_events
CREATE OR REPLACE FUNCTION public.trg_client_event_from_disposition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.client_events (tenant_id, client_id, client_cpf, event_type, event_source, event_channel, event_value, metadata, created_at)
  SELECT
    NEW.tenant_id,
    NEW.client_id,
    COALESCE(c.cpf, ''),
    'disposition',
    'operator',
    'call',
    NEW.disposition_type,
    jsonb_build_object('notes', NEW.notes, 'scheduled_callback', NEW.scheduled_callback),
    NEW.created_at
  FROM public.clients c WHERE c.id = NEW.client_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_disposition_to_event
  AFTER INSERT ON public.call_dispositions
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_event_from_disposition();

-- 2. call_logs → client_events
CREATE OR REPLACE FUNCTION public.trg_client_event_from_call_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.client_events (tenant_id, client_id, client_cpf, event_type, event_source, event_channel, event_value, metadata, created_at)
  VALUES (
    NEW.tenant_id,
    NEW.client_id,
    COALESCE(NEW.client_cpf, ''),
    'call',
    'system',
    'call',
    COALESCE(NEW.status, 'unknown'),
    jsonb_build_object('duration_seconds', NEW.duration_seconds, 'agent_name', NEW.agent_name, 'campaign_name', NEW.campaign_name),
    NEW.called_at
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_call_log_to_event
  AFTER INSERT ON public.call_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_event_from_call_log();

-- 3. chat_messages → client_events
CREATE OR REPLACE FUNCTION public.trg_client_event_from_chat_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _conv record;
BEGIN
  SELECT c.tenant_id, c.client_id, cl.cpf AS client_cpf
  INTO _conv
  FROM public.conversations c
  LEFT JOIN public.clients cl ON cl.id = c.client_id
  WHERE c.id = NEW.conversation_id;

  IF _conv IS NOT NULL AND _conv.client_cpf IS NOT NULL THEN
    INSERT INTO public.client_events (tenant_id, client_id, client_cpf, event_type, event_source, event_channel, event_value, metadata, created_at)
    VALUES (
      _conv.tenant_id,
      _conv.client_id,
      _conv.client_cpf,
      CASE WHEN NEW.direction = 'inbound' THEN 'whatsapp_inbound' ELSE 'whatsapp_outbound' END,
      CASE WHEN NEW.is_internal THEN 'operator' ELSE 'system' END,
      'whatsapp',
      NEW.message_type,
      jsonb_build_object('direction', NEW.direction, 'status', NEW.status),
      NEW.created_at
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_message_to_event
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_event_from_chat_message();

-- 4. agreements → client_events (INSERT and UPDATE)
CREATE OR REPLACE FUNCTION public.trg_client_event_from_agreement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _event_type text;
  _client_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _event_type := 'agreement_created';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN _event_type := 'agreement_approved';
    ELSIF NEW.status = 'cancelled' THEN _event_type := 'agreement_cancelled';
    ELSIF NEW.status = 'overdue' THEN _event_type := 'agreement_overdue';
    ELSE _event_type := 'agreement_status_' || NEW.status;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  SELECT id INTO _client_id FROM public.clients
  WHERE tenant_id = NEW.tenant_id
    AND REPLACE(REPLACE(cpf, '.', ''), '-', '') = REPLACE(REPLACE(NEW.client_cpf, '.', ''), '-', '')
  LIMIT 1;

  INSERT INTO public.client_events (tenant_id, client_id, client_cpf, event_type, event_source, event_channel, event_value, metadata, created_at)
  VALUES (
    NEW.tenant_id,
    _client_id,
    NEW.client_cpf,
    _event_type,
    'operator',
    NULL,
    NEW.status,
    jsonb_build_object('agreement_id', NEW.id, 'proposed_total', NEW.proposed_total, 'original_total', NEW.original_total),
    now()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agreement_to_event_insert
  AFTER INSERT ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_event_from_agreement();

CREATE TRIGGER trg_agreement_to_event_update
  AFTER UPDATE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_event_from_agreement();

-- 5. agreement_signatures → client_events
CREATE OR REPLACE FUNCTION public.trg_client_event_from_signature()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agr record;
  _client_id uuid;
BEGIN
  SELECT tenant_id, client_cpf INTO _agr FROM public.agreements WHERE id = NEW.agreement_id;
  IF _agr IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO _client_id FROM public.clients
  WHERE tenant_id = _agr.tenant_id
    AND REPLACE(REPLACE(cpf, '.', ''), '-', '') = REPLACE(REPLACE(_agr.client_cpf, '.', ''), '-', '')
  LIMIT 1;

  INSERT INTO public.client_events (tenant_id, client_id, client_cpf, event_type, event_source, event_channel, event_value, metadata, created_at)
  VALUES (
    _agr.tenant_id,
    _client_id,
    _agr.client_cpf,
    'agreement_signed',
    'operator',
    NULL,
    NEW.signature_type,
    jsonb_build_object('agreement_id', NEW.agreement_id, 'signature_type', NEW.signature_type),
    NEW.signed_at
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_signature_to_event
  AFTER INSERT ON public.agreement_signatures
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_event_from_signature();

-- 6. message_logs → client_events
CREATE OR REPLACE FUNCTION public.trg_client_event_from_message_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _client_id uuid;
BEGIN
  SELECT id INTO _client_id FROM public.clients
  WHERE tenant_id = NEW.tenant_id
    AND REPLACE(REPLACE(cpf, '.', ''), '-', '') = REPLACE(REPLACE(NEW.client_cpf, '.', ''), '-', '')
  LIMIT 1;

  INSERT INTO public.client_events (tenant_id, client_id, client_cpf, event_type, event_source, event_channel, event_value, metadata, created_at)
  VALUES (
    NEW.tenant_id,
    _client_id,
    COALESCE(NEW.client_cpf, ''),
    'message_sent',
    'prevention',
    COALESCE(NEW.channel, 'whatsapp'),
    NEW.status,
    jsonb_build_object('rule_id', NEW.rule_id, 'channel', NEW.channel),
    NEW.sent_at
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_message_log_to_event
  AFTER INSERT ON public.message_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_event_from_message_log();
