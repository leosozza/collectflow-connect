CREATE OR REPLACE FUNCTION public.trigger_score_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _score_updated timestamptz;
  _clean_cpf text;
  _service_role_key text;
  _supabase_url text;
BEGIN
  -- Skip field_update events (too noisy, not score-relevant)
  IF NEW.event_type = 'field_update' THEN
    RETURN NEW;
  END IF;

  -- Clean CPF
  _clean_cpf := regexp_replace(NEW.client_cpf, '\D', '', 'g');
  IF length(_clean_cpf) < 11 THEN
    RETURN NEW;
  END IF;

  -- Debounce: skip if score was updated in the last 5 minutes for this CPF
  SELECT score_updated_at INTO _score_updated
  FROM public.clients
  WHERE tenant_id = NEW.tenant_id
    AND regexp_replace(cpf, '\D', '', 'g') = _clean_cpf
    AND score_updated_at IS NOT NULL
    AND score_updated_at > (now() - interval '5 minutes')
  LIMIT 1;

  IF _score_updated IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get secrets for the HTTP call
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _service_role_key := current_setting('app.settings.service_role_key', true);

  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    _supabase_url := 'https://hulwcntfioqifopyjcvv.supabase.co';
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/calculate-propensity',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(_service_role_key, current_setting('supabase.service_role_key', true))
      ),
      body := jsonb_build_object('cpf', _clean_cpf, 'tenant_id', NEW.tenant_id::text)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[trigger_score_recalc] HTTP call failed for CPF %: %', LEFT(_clean_cpf, 3) || '***', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;