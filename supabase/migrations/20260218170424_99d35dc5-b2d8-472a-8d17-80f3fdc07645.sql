
-- Create operator_points table for gamification
CREATE TABLE public.operator_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  points integer NOT NULL DEFAULT 0,
  payments_count integer NOT NULL DEFAULT 0,
  breaks_count integer NOT NULL DEFAULT 0,
  total_received numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operator_id, year, month)
);

-- Enable RLS
ALTER TABLE public.operator_points ENABLE ROW LEVEL SECURITY;

-- All users in tenant can view ranking
CREATE POLICY "Tenant users can view operator_points"
  ON public.operator_points
  FOR SELECT
  USING ((tenant_id = get_my_tenant_id()) OR is_super_admin(auth.uid()));

-- Operators can upsert their own points
CREATE POLICY "Users can upsert own operator_points"
  ON public.operator_points
  FOR INSERT
  WITH CHECK (
    (operator_id = get_my_profile_id()) AND (tenant_id = get_my_tenant_id())
  );

CREATE POLICY "Users can update own operator_points"
  ON public.operator_points
  FOR UPDATE
  USING (
    (operator_id = get_my_profile_id()) AND (tenant_id = get_my_tenant_id())
  );

-- Admins can manage all
CREATE POLICY "Tenant admins can manage operator_points"
  ON public.operator_points
  FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_points;

-- achievements also needs insert for operators
CREATE POLICY "Tenant users can insert achievements"
  ON public.achievements
  FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());
