ALTER TABLE public.client_profiles
ADD COLUMN IF NOT EXISTS phone_has_whatsapp BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_client_profiles_phone_has_whatsapp
ON public.client_profiles (tenant_id, phone_has_whatsapp);