
DROP POLICY IF EXISTS "Operators can view own goals" ON public.operator_goals;

CREATE POLICY "Operators can view own goals"
ON public.operator_goals
FOR SELECT
TO authenticated
USING ((operator_id = get_my_profile_id()) AND (tenant_id = get_my_tenant_id()));
