-- Create a SECURITY DEFINER function to get full tenant user data bypassing RLS
CREATE OR REPLACE FUNCTION public.get_user_tenant_data()
RETURNS TABLE(
  tu_id uuid,
  tu_tenant_id uuid,
  tu_user_id uuid,
  tu_role tenant_role,
  tu_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, tenant_id, user_id, role, created_at
  FROM public.tenant_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;