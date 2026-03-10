
-- Seed tenant_tokens for existing tenants that don't have one
INSERT INTO public.tenant_tokens (tenant_id, token_balance, lifetime_purchased, updated_at)
SELECT t.id, 50, 50, now()
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_tokens tt WHERE tt.tenant_id = t.id
);

-- Update onboard_tenant RPC to accept cnpj and init tenant_tokens
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
  INSERT INTO public.tenants (name, slug, plan_id, cnpj, status)
  VALUES (_name, _slug, _plan_id, _cnpj, 'active')
  RETURNING id INTO _tenant_id;

  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (_tenant_id, _user_id, 'admin');

  UPDATE public.profiles
  SET tenant_id = _tenant_id, role = 'admin'
  WHERE id = _user_id;

  INSERT INTO public.tenant_tokens (tenant_id, token_balance, lifetime_purchased, updated_at)
  VALUES (_tenant_id, 50, 50, now());

  INSERT INTO public.token_transactions (tenant_id, transaction_type, amount, balance_after, description, created_by)
  VALUES (_tenant_id, 'credit', 50, 50, 'Saldo inicial de boas-vindas', _user_id);

  RETURN _tenant_id;
END;
$$;
