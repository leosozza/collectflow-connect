-- Trigger anti-downgrade: impede sair de QUITADO sem override explícito
CREATE OR REPLACE FUNCTION public.enforce_client_status_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_role text;
  v_new_role text;
  v_force    text;
BEGIN
  -- Skip if status_cobranca_id didn't change
  IF NEW.status_cobranca_id IS NOT DISTINCT FROM OLD.status_cobranca_id THEN
    RETURN NEW;
  END IF;

  -- Allow first assignment (NULL -> any)
  IF OLD.status_cobranca_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve old role
  SELECT regras->>'papel_sistema' INTO v_old_role
  FROM public.tipos_status
  WHERE id = OLD.status_cobranca_id;

  -- Only protect QUITADO
  IF v_old_role <> 'quitado' THEN
    RETURN NEW;
  END IF;

  -- Resolve new role
  SELECT regras->>'papel_sistema' INTO v_new_role
  FROM public.tipos_status
  WHERE id = NEW.status_cobranca_id;

  -- Allow staying quitado (e.g. switching to another quitado record)
  IF v_new_role = 'quitado' THEN
    RETURN NEW;
  END IF;

  -- Allow only with explicit override flag
  v_force := current_setting('app.force_status_override', true);
  IF v_force = 'true' THEN
    RETURN NEW;
  END IF;

  RAISE WARNING 'Blocked status downgrade for client % from QUITADO to %; preserving QUITADO. Set app.force_status_override=true to override.',
    NEW.id, COALESCE(v_new_role, 'unknown');

  -- Silently preserve old status instead of erroring (avoid breaking unrelated updates)
  NEW.status_cobranca_id := OLD.status_cobranca_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_client_status_hierarchy ON public.clients;
CREATE TRIGGER trg_enforce_client_status_hierarchy
BEFORE UPDATE OF status_cobranca_id ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.enforce_client_status_hierarchy();