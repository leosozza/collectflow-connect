
-- Create debtor profile enum
CREATE TYPE public.debtor_profile_type AS ENUM ('ocasional', 'recorrente', 'resistente', 'insatisfeito');

-- Add debtor_profile and suggested_profile columns to clients
ALTER TABLE public.clients ADD COLUMN debtor_profile public.debtor_profile_type;
ALTER TABLE public.clients ADD COLUMN suggested_profile public.debtor_profile_type;
