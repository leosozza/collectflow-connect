ALTER TABLE public.credores
  ADD COLUMN IF NOT EXISTS "cobrança_direta_ativa" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_credores_cobranca_direta_ativa
  ON public.credores (tenant_id)
  WHERE "cobrança_direta_ativa" = true;