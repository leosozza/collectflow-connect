
-- Fix tenant_tokens UPDATE policy - restrict to admins/super_admins only
DROP POLICY IF EXISTS "Sistema atualiza tokens" ON public.tenant_tokens;

CREATE POLICY "Admins can update tenant_tokens"
ON public.tenant_tokens FOR UPDATE
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Fix tenant_users privilege escalation - prevent admins from assigning super_admin role
DROP POLICY IF EXISTS "Tenant admins can insert tenant_users" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant admins can update tenant_users" ON public.tenant_users;

CREATE POLICY "Tenant admins can insert tenant_users"
ON public.tenant_users FOR INSERT
TO authenticated
WITH CHECK (
  (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  AND (role <> 'super_admin' OR is_super_admin(auth.uid()))
);

CREATE POLICY "Tenant admins can update tenant_users"
ON public.tenant_users FOR UPDATE
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (role <> 'super_admin' OR is_super_admin(auth.uid()));
