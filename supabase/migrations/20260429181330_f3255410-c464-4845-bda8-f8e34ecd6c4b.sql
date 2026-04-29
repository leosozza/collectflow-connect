-- 1. Add end_time + auto_closed_at to campaigns
ALTER TABLE public.gamification_campaigns
  ADD COLUMN IF NOT EXISTS end_time time without time zone NOT NULL DEFAULT '23:59:00',
  ADD COLUMN IF NOT EXISTS auto_closed_at timestamptz NULL;

-- 2. Celebration views table
CREATE TABLE IF NOT EXISTS public.campaign_celebration_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.gamification_campaigns(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, operator_id)
);

ALTER TABLE public.campaign_celebration_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators view own celebration views" ON public.campaign_celebration_views;
CREATE POLICY "Operators view own celebration views"
  ON public.campaign_celebration_views
  FOR SELECT
  TO authenticated
  USING (operator_id = auth.uid() AND tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "Operators insert own celebration views" ON public.campaign_celebration_views;
CREATE POLICY "Operators insert own celebration views"
  ON public.campaign_celebration_views
  FOR INSERT
  TO authenticated
  WITH CHECK (operator_id = auth.uid() AND tenant_id = public.get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_campaign_celebration_views_op
  ON public.campaign_celebration_views (operator_id, campaign_id);

-- 3. Realtime: replica identity full + add to publication (idempotent)
ALTER TABLE public.gamification_campaigns REPLICA IDENTITY FULL;
ALTER TABLE public.campaign_participants REPLICA IDENTITY FULL;
ALTER TABLE public.campaign_credores REPLICA IDENTITY FULL;
ALTER TABLE public.operator_points REPLICA IDENTITY FULL;
ALTER TABLE public.campaign_celebration_views REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gamification_campaigns;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_participants;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_credores;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_points;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_celebration_views;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;