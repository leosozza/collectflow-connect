
ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS origin_type text DEFAULT 'carteira',
  ADD COLUMN IF NOT EXISTS origin_id uuid,
  ADD COLUMN IF NOT EXISTS workflow_id uuid,
  ADD COLUMN IF NOT EXISTS rule_id uuid,
  ADD COLUMN IF NOT EXISTS trigger_type text;

-- Backfill existing campaigns with a generated name
UPDATE public.whatsapp_campaigns SET name = 'Campanha #' || EXTRACT(EPOCH FROM created_at)::int
WHERE name IS NULL;
