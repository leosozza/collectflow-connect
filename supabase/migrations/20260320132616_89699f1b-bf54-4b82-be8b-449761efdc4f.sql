
CREATE OR REPLACE FUNCTION public.trg_client_event_from_disposition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    jsonb_build_object('notes', NEW.notes, 'scheduled_callback', NEW.scheduled_callback, 'operator_id', NEW.operator_id),
    NEW.created_at
  FROM public.clients c WHERE c.id = NEW.client_id;
  RETURN NEW;
END;
$function$;
