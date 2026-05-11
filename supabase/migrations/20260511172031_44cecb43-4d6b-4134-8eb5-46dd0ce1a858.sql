ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_steps_state JSONB NOT NULL DEFAULT '{}'::jsonb;