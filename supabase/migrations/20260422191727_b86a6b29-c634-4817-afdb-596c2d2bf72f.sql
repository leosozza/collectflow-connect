
ALTER TABLE public.manual_payments DROP CONSTRAINT IF EXISTS manual_payments_status_check;
ALTER TABLE public.manual_payments
  ADD CONSTRAINT manual_payments_status_check
  CHECK (status = ANY (ARRAY['pending_confirmation'::text, 'confirmed'::text, 'rejected'::text, 'superseded'::text]));
