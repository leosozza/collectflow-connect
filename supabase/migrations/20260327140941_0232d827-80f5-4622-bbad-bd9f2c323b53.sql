ALTER TABLE public.negociarie_cobrancas 
  ADD COLUMN IF NOT EXISTS valor_pago numeric,
  ADD COLUMN IF NOT EXISTS data_pagamento date;