
-- Add propensity score column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS propensity_score integer;

-- Add index for score-based queries
CREATE INDEX IF NOT EXISTS idx_clients_propensity_score ON public.clients(propensity_score DESC NULLS LAST);

-- Add creditor-specific portal settings columns
ALTER TABLE public.credores ADD COLUMN IF NOT EXISTS portal_hero_title text;
ALTER TABLE public.credores ADD COLUMN IF NOT EXISTS portal_hero_subtitle text;
ALTER TABLE public.credores ADD COLUMN IF NOT EXISTS portal_logo_url text;
ALTER TABLE public.credores ADD COLUMN IF NOT EXISTS portal_primary_color text;
ALTER TABLE public.credores ADD COLUMN IF NOT EXISTS portal_enabled boolean DEFAULT false;
