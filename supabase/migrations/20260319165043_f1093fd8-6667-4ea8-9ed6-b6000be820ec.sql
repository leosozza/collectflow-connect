ALTER TABLE public.call_disposition_types
  ADD COLUMN IF NOT EXISTS schedule_allow_other_number boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_days_limit integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS blocklist_mode text NOT NULL DEFAULT 'indeterminate',
  ADD COLUMN IF NOT EXISTS blocklist_days integer NOT NULL DEFAULT 0;