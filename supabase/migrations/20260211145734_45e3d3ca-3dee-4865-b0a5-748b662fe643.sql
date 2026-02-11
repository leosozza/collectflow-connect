
-- Remover a policy permissiva de criação de tenants
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

-- Criar policy mais restritiva: só permite criar tenant se o usuário ainda não pertence a nenhum tenant
CREATE POLICY "New users can create first tenant"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);
