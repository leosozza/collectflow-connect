
-- Colunas normalizadas
ALTER TABLE public.client_phones
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS phone_last8 text,
  ADD COLUMN IF NOT EXISTS phone_last10 text,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Índices para lookup
CREATE INDEX IF NOT EXISTS idx_client_phones_tenant_e164 ON public.client_phones (tenant_id, phone_e164);
CREATE INDEX IF NOT EXISTS idx_client_phones_tenant_last8 ON public.client_phones (tenant_id, phone_last8);
CREATE INDEX IF NOT EXISTS idx_client_phones_client_id ON public.client_phones (client_id);

-- Função de normalização
CREATE OR REPLACE FUNCTION public.normalize_phone_br(_phone text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  digits text;
  ddd text;
  num text;
BEGIN
  digits := regexp_replace(_phone, '\D', '', 'g');
  IF length(digits) < 10 THEN RETURN NULL; END IF;
  IF length(digits) = 13 AND digits LIKE '55%' THEN RETURN digits; END IF;
  IF length(digits) = 12 AND digits LIKE '55%' THEN
    ddd := substring(digits FROM 3 FOR 2);
    num := substring(digits FROM 5);
    RETURN '55' || ddd || '9' || num;
  END IF;
  IF length(digits) = 11 THEN RETURN '55' || digits; END IF;
  IF length(digits) = 10 THEN
    ddd := substring(digits FROM 1 FOR 2);
    num := substring(digits FROM 3);
    RETURN '55' || ddd || '9' || num;
  END IF;
  IF digits NOT LIKE '55%' THEN RETURN '55' || digits; END IF;
  RETURN digits;
END;
$$;
