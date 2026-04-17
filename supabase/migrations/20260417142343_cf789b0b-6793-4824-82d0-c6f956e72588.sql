ALTER TABLE public.manual_payments ADD COLUMN IF NOT EXISTS installment_key TEXT;

UPDATE public.manual_payments
SET installment_key = CASE
  WHEN installment_number = 0 THEN 'entrada'
  ELSE installment_number::text
END
WHERE installment_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_payments_agreement_key
  ON public.manual_payments (agreement_id, installment_key);