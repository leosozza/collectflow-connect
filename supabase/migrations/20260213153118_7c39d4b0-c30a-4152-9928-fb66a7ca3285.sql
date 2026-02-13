-- Add 3CPlus agent ID mapping to profiles
ALTER TABLE public.profiles ADD COLUMN threecplus_agent_id integer;

-- Add index for quick lookups
CREATE INDEX idx_profiles_threecplus_agent_id ON public.profiles (threecplus_agent_id) WHERE threecplus_agent_id IS NOT NULL;