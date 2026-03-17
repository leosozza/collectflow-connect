
-- Score Operacional V1: Add auxiliary metadata columns to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS suggested_queue text DEFAULT 'low_history',
  ADD COLUMN IF NOT EXISTS score_reason text,
  ADD COLUMN IF NOT EXISTS score_confidence text DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS score_updated_at timestamptz;
