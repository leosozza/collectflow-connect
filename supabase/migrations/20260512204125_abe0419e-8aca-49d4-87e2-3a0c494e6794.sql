CREATE OR REPLACE FUNCTION public.sync_profile_role_from_tenant_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapped_role text;
BEGIN
  mapped_role := CASE WHEN NEW.role::text = 'admin' THEN 'admin' ELSE 'operador' END;

  UPDATE public.profiles
     SET role = mapped_role::app_role
   WHERE user_id = NEW.user_id
     AND role::text IS DISTINCT FROM mapped_role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role_from_tenant_users ON public.tenant_users;
CREATE TRIGGER trg_sync_profile_role_from_tenant_users
AFTER INSERT OR UPDATE OF role ON public.tenant_users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_role_from_tenant_users();

UPDATE public.profiles p
   SET role = (CASE WHEN tu.role::text = 'admin' THEN 'admin' ELSE 'operador' END)::app_role
  FROM public.tenant_users tu
 WHERE tu.user_id = p.user_id
   AND p.role::text IS DISTINCT FROM (CASE WHEN tu.role::text = 'admin' THEN 'admin' ELSE 'operador' END);