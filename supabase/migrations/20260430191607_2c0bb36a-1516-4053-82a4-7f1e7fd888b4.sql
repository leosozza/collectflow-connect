ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS valor_pago_origem jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clients.valor_pago_origem IS
  'Histórico de origem dos pagamentos abatidos. Cada entrada: { source: "agreement_credit"|"direct", source_agreement_id, amount, applied_at, applied_by, note }';
