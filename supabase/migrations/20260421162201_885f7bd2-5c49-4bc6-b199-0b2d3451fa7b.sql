-- Add scheduling + recurrence columns to whatsapp_campaigns
ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS recurrence_rule jsonb,
  ADD COLUMN IF NOT EXISTS recurrence_run_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_campaign_id uuid REFERENCES public.whatsapp_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audience_metadata jsonb;

-- Constraint on schedule_type
DO $$ BEGIN
  ALTER TABLE public.whatsapp_campaigns
    ADD CONSTRAINT whatsapp_campaigns_schedule_type_chk CHECK (schedule_type IN ('once','recurring'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Partial index for scheduler
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_scheduled
  ON public.whatsapp_campaigns (scheduled_for)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_parent
  ON public.whatsapp_campaigns (parent_campaign_id)
  WHERE parent_campaign_id IS NOT NULL;

-- History table of recurring runs
CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_campaign_id uuid NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  child_campaign_id uuid REFERENCES public.whatsapp_campaigns(id) ON DELETE SET NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'triggered',
  recipients_count int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_runs_parent
  ON public.whatsapp_campaign_runs (parent_campaign_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_runs_tenant
  ON public.whatsapp_campaign_runs (tenant_id, run_at DESC);

ALTER TABLE public.whatsapp_campaign_runs ENABLE ROW LEVEL SECURITY;

-- RLS: tenant isolation
DROP POLICY IF EXISTS "Tenant members can view campaign runs" ON public.whatsapp_campaign_runs;
CREATE POLICY "Tenant members can view campaign runs"
  ON public.whatsapp_campaign_runs
  FOR SELECT
  USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "Service role manages campaign runs" ON public.whatsapp_campaign_runs;
CREATE POLICY "Service role manages campaign runs"
  ON public.whatsapp_campaign_runs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Enable required extensions for scheduled dispatcher
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;