
-- Create manual_payments table
CREATE TABLE public.manual_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  amount_paid numeric NOT NULL,
  payment_date date NOT NULL,
  payment_method text NOT NULL,
  receiver text NOT NULL CHECK (receiver IN ('CREDOR', 'COBRADORA')),
  notes text,
  status text NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN ('pending_confirmation', 'confirmed', 'rejected')),
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add manual_payment_id to client_attachments
ALTER TABLE public.client_attachments ADD COLUMN manual_payment_id uuid REFERENCES public.manual_payments(id);

-- Enable RLS
ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies: tenant isolation
CREATE POLICY "Users can view manual payments in their tenant"
  ON public.manual_payments FOR SELECT TO authenticated
  USING (tenant_id = (SELECT get_my_tenant_id()));

CREATE POLICY "Users can insert manual payments in their tenant"
  ON public.manual_payments FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT get_my_tenant_id()));

CREATE POLICY "Users can update manual payments in their tenant"
  ON public.manual_payments FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT get_my_tenant_id()));

-- Index for performance
CREATE INDEX idx_manual_payments_tenant_status ON public.manual_payments(tenant_id, status);
CREATE INDEX idx_manual_payments_agreement ON public.manual_payments(agreement_id);
