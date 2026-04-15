-- Fix SELECT policy on tenant_users to allow tenant admins to see all members
DROP POLICY IF EXISTS "Users can view own tenant memberships" ON public.tenant_users;
DROP POLICY IF EXISTS "Users can view tenant memberships" ON public.tenant_users;

CREATE POLICY "Users can view tenant memberships" ON public.tenant_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_tenant_admin(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );