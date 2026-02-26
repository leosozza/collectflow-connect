
-- Add provider column to whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'evolution';

-- Add comment
COMMENT ON COLUMN public.whatsapp_instances.provider IS 'Provider type: evolution or wuzapi';
