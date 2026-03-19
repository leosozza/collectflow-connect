ALTER TABLE public.call_disposition_types
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS impact text NOT NULL DEFAULT 'negativo',
  ADD COLUMN IF NOT EXISTS behavior text NOT NULL DEFAULT 'repetir',
  ADD COLUMN IF NOT EXISTS is_conversion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_cpc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_unknown boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_callback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_schedule boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blocklist boolean NOT NULL DEFAULT false;