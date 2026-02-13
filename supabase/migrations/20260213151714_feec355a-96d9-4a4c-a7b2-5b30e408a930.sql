
CREATE TABLE public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  page_path text,
  action_detail text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_activity_logs_user_date ON public.user_activity_logs (user_id, created_at DESC);
CREATE INDEX idx_user_activity_logs_tenant ON public.user_activity_logs (tenant_id, created_at DESC);

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view all activity logs"
ON public.user_activity_logs FOR SELECT
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view own activity logs"
ON public.user_activity_logs FOR SELECT
USING (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

CREATE POLICY "Users can insert own activity logs"
ON public.user_activity_logs FOR INSERT
WITH CHECK (user_id = auth.uid() AND tenant_id = get_my_tenant_id());
