
-- Add missing fields for MaxList/MaxSystem integration
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cod_contrato text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_pagamento date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone2 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone3 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS valor_saldo numeric DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS valor_atualizado numeric DEFAULT 0;

-- Add index for contract number lookups
CREATE INDEX IF NOT EXISTS idx_clients_cod_contrato ON public.clients (cod_contrato) WHERE cod_contrato IS NOT NULL;
