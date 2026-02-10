
-- Fix 1: Prevent privilege escalation on profile insert
-- Force role to 'operador' for any non-admin inserting a profile
CREATE OR REPLACE FUNCTION public.enforce_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can set a role other than 'operador'
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.role := 'operador'::app_role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_default_role_on_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_default_role();

-- Also prevent non-admins from updating their own role
CREATE OR REPLACE FUNCTION public.enforce_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can change roles
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_role_on_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_role_update();
