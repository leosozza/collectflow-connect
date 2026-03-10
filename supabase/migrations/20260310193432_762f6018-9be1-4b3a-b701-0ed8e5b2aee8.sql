-- Drop the old 3-param version (obsolete)
DROP FUNCTION IF EXISTS public.onboard_tenant(text, text, uuid);

-- Recreate the 4-param version with fixes
CREATE OR REPLACE FUNCTION public.onboard_tenant(
  _name text,
  _slug text,
  _plan_id uuid,
  _cnpj text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Check if user already has a tenant
  IF EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'Usuário já possui uma empresa';
  END IF;

  -- Check if slug already exists
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = _slug) THEN
    RAISE EXCEPTION 'Identificador já está em uso';
  END IF;

  -- Create tenant
  INSERT INTO public.tenants (name, slug, plan_id, cnpj, status)
  VALUES (_name, _slug, _plan_id, _cnpj, 'active')
  RETURNING id INTO _tenant_id;

  -- Create tenant_user with admin role
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (_tenant_id, _user_id, 'admin');

  -- FIX: use WHERE user_id (not WHERE id)
  UPDATE public.profiles
  SET tenant_id = _tenant_id, role = 'admin'
  WHERE user_id = _user_id;

  -- Initialize token balance with welcome credit
  INSERT INTO public.tenant_tokens (tenant_id, token_balance, lifetime_purchased, updated_at)
  VALUES (_tenant_id, 50, 50, now());

  INSERT INTO public.token_transactions (tenant_id, transaction_type, amount, balance_after, description, created_by)
  VALUES (_tenant_id, 'credit', 50, 50, 'Saldo inicial de boas-vindas', _user_id);

  RETURN _tenant_id;
END;
$$;