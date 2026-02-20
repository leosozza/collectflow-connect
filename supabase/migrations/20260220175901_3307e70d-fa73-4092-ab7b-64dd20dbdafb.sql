
-- Step 1: Add new roles to tenant_role enum
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'supervisor';

-- Step 2: Create user_permissions table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module text NOT NULL,
  actions text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(profile_id, module)
);

-- Step 3: Enable RLS on user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS policies for user_permissions
CREATE POLICY "Tenant admins can manage user_permissions"
ON public.user_permissions
FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view own permissions"
ON public.user_permissions
FOR SELECT
USING (
  profile_id = get_my_profile_id()
  OR is_tenant_admin(auth.uid(), tenant_id)
  OR is_super_admin(auth.uid())
);

-- Step 5: Update timestamp trigger for user_permissions
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Step 6: SECURITY DEFINER RPC to get user permissions
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(module text, actions text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.module, up.actions
  FROM public.user_permissions up
  WHERE up.profile_id = get_my_profile_id()
    AND up.tenant_id = get_my_tenant_id();
$$;

-- Step 7: Update is_tenant_admin to also include gerente/supervisor where applicable
-- Keep is_tenant_admin only for true admins (admin + super_admin roles)
-- Create new helper functions for role checking

CREATE OR REPLACE FUNCTION public.get_my_tenant_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.tenant_users
  WHERE user_id = auth.uid() LIMIT 1;
$$;
