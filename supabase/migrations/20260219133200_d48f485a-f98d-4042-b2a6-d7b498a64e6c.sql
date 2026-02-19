
-- Add SLA hours per credor (NULL = use tenant default)
ALTER TABLE public.credores ADD COLUMN sla_hours NUMERIC DEFAULT NULL;

-- Add SLA notification control column
ALTER TABLE public.conversations ADD COLUMN sla_notified_at TIMESTAMPTZ DEFAULT NULL;
