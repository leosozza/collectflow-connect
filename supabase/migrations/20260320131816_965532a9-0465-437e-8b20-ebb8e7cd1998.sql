
-- 1) Update agreement trigger to include created_by in metadata
CREATE OR REPLACE FUNCTION public.trg_client_event_from_agreement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    jsonb_build_object(
      'agreement_id', NEW.id,
      'proposed_total', NEW.proposed_total,
      'original_total', NEW.original_total,
      'created_by', NEW.created_by,
      'credor', NEW.credor,
      'new_installments', NEW.new_installments,
      'discount_percent', NEW.discount_percent
    ),
    now()
  );
  RETURN NEW;
END;
$function$;

-- 2) Trigger: client_update_logs → client_events
CREATE OR REPLACE FUNCTION public.trg_client_event_from_update_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _client_cpf text;
BEGIN
  SELECT cpf INTO _client_cpf FROM public.clients WHERE id = NEW.client_id;

  INSERT INTO public.client_events (tenant_id, client_id, client_cpf, event_type, event_source, event_channel, event_value, metadata, created_at)
  VALUES (
    NEW.tenant_id,
    NEW.client_id,
    COALESCE(_client_cpf, ''),
    'field_update',
    COALESCE(NEW.source, 'manual'),
    NULL,
    NEW.source,
    jsonb_build_object('changes', NEW.changes, 'updated_by', NEW.updated_by),
    COALESCE(NEW.created_at, now())
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_client_event_from_update_log
AFTER INSERT ON public.client_update_logs
FOR EACH ROW EXECUTE FUNCTION public.trg_client_event_from_update_log();
