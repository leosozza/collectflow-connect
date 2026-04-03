
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS cancellation_type text DEFAULT NULL;
COMMENT ON COLUMN public.agreements.cancellation_type IS 'manual = operador cancelou, auto_expired = sistema quebrou por falta de pagamento';
