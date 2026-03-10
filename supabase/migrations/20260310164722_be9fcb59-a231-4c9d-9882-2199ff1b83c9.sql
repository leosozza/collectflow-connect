
-- Fix overly permissive RLS policy on service_usage_logs
DROP POLICY "Sistema insere logs" ON public.service_usage_logs;
CREATE POLICY "Sistema insere logs" ON public.service_usage_logs
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()) OR auth.role() = 'service_role');
