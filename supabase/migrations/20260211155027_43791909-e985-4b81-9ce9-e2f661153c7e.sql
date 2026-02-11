
-- =============================================
-- FASE 4: notifications, audit_logs, operator_goals
-- =============================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  reference_type TEXT,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- SECURITY DEFINER function to create notifications (bypasses RLS)
CREATE OR REPLACE FUNCTION public.create_notification(
  _tenant_id UUID,
  _user_id UUID,
  _title TEXT,
  _message TEXT,
  _type TEXT DEFAULT 'info',
  _reference_type TEXT DEFAULT NULL,
  _reference_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.notifications (tenant_id, user_id, title, message, type, reference_type, reference_id)
  VALUES (_tenant_id, _user_id, _title, _message, _type, _reference_type, _reference_id)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Enable Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;

-- 2. AUDIT_LOGS TABLE
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins see all tenant logs, operators see only own
CREATE POLICY "Tenant admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Operators can view own audit logs"
  ON public.audit_logs FOR SELECT
  USING (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

-- Insert: any authenticated tenant user can insert their own logs
CREATE POLICY "Users can insert own audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs (tenant_id, created_at DESC);

-- 3. OPERATOR_GOALS TABLE
CREATE TABLE public.operator_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, operator_id, year, month)
);

ALTER TABLE public.operator_goals ENABLE ROW LEVEL SECURITY;

-- Admins manage goals
CREATE POLICY "Tenant admins can manage goals"
  ON public.operator_goals FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Operators can view their own goals
CREATE POLICY "Operators can view own goals"
  ON public.operator_goals FOR SELECT
  USING (operator_id = auth.uid() AND tenant_id = get_my_tenant_id());

CREATE TRIGGER update_operator_goals_updated_at
  BEFORE UPDATE ON public.operator_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
