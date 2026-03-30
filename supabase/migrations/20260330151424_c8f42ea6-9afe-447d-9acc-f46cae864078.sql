ALTER TABLE public.call_disposition_types ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'call';

ALTER TABLE public.call_disposition_types DROP CONSTRAINT IF EXISTS call_disposition_types_channel_check;
ALTER TABLE public.call_disposition_types ADD CONSTRAINT call_disposition_types_channel_check CHECK (channel IN ('call', 'whatsapp'));