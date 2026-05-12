CREATE OR REPLACE FUNCTION public.enforce_role_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow system context (no auth.uid, e.g. triggers/migrations) and admins
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.role := 'operador'::app_role;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.profiles p
   SET role = (CASE WHEN tu.role::text = 'admin' THEN 'admin' ELSE 'operador' END)::app_role
  FROM public.tenant_users tu
 WHERE tu.user_id = p.user_id
   AND p.role::text IS DISTINCT FROM (CASE WHEN tu.role::text = 'admin' THEN 'admin' ELSE 'operador' END);