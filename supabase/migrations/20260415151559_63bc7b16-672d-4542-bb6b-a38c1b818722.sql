
-- Add processing lock and claim columns to campaign recipients
ALTER TABLE public.whatsapp_campaign_recipients 
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS claimed_by text DEFAULT NULL;

-- Add processing lock to campaigns
ALTER TABLE public.whatsapp_campaigns 
  ADD COLUMN IF NOT EXISTS processing_locked_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS processing_locked_by text DEFAULT NULL;

-- Create atomic claim function for recipients
CREATE OR REPLACE FUNCTION public.claim_campaign_recipients(
  _campaign_id uuid,
  _instance_id uuid,
  _worker_id text,
  _limit int DEFAULT 1
)
RETURNS SETOF public.whatsapp_campaign_recipients
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claimable AS (
    SELECT id FROM public.whatsapp_campaign_recipients
    WHERE campaign_id = _campaign_id
      AND assigned_instance_id = _instance_id
      AND status = 'pending'
      AND (claimed_at IS NULL OR claimed_at < now() - interval '10 minutes')
    ORDER BY created_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.whatsapp_campaign_recipients r
  SET claimed_at = now(), claimed_by = _worker_id, status = 'processing'
  FROM claimable c
  WHERE r.id = c.id
  RETURNING r.*;
$$;

-- Create campaign lock function
CREATE OR REPLACE FUNCTION public.try_lock_campaign(
  _campaign_id uuid,
  _worker_id text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked boolean;
BEGIN
  UPDATE public.whatsapp_campaigns
  SET processing_locked_at = now(), processing_locked_by = _worker_id
  WHERE id = _campaign_id
    AND (processing_locked_at IS NULL OR processing_locked_at < now() - interval '10 minutes')
  RETURNING true INTO locked;
  
  RETURN COALESCE(locked, false);
END;
$$;

-- Release campaign lock
CREATE OR REPLACE FUNCTION public.release_campaign_lock(
  _campaign_id uuid,
  _worker_id text
)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.whatsapp_campaigns
  SET processing_locked_at = NULL, processing_locked_by = NULL
  WHERE id = _campaign_id AND processing_locked_by = _worker_id;
$$;
