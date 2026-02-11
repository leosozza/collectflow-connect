
-- Create a SECURITY DEFINER function for atomic tenant onboarding
CREATE OR REPLACE FUNCTION public.onboard_tenant(
  _name TEXT,
  _slug TEXT,
  _plan_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id UUID;
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Check if user already has a tenant
  IF EXISTS (SELECT 1 FROM tenant_users WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'Usuário já possui uma empresa';
  END IF;

  -- Check if slug already exists
  IF EXISTS (SELECT 1 FROM tenants WHERE slug = _slug) THEN
    RAISE EXCEPTION 'Identificador já está em uso';
  END IF;

  -- Create tenant
  INSERT INTO tenants (name, slug, plan_id)
  VALUES (_name, _slug, _plan_id)
  RETURNING id INTO _tenant_id;

  -- Create tenant_user with admin role
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (_tenant_id, _user_id, 'admin');

  -- Update profile with tenant_id and admin role
  UPDATE profiles
  SET tenant_id = _tenant_id, role = 'admin'
  WHERE user_id = _user_id;

  RETURN _tenant_id;
END;
$$;
