
-- Add checkout_token and portal_origin to agreements
ALTER TABLE public.agreements
  ADD COLUMN IF NOT EXISTS checkout_token text UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS portal_origin boolean NOT NULL DEFAULT false;

-- Create portal_payments table
CREATE TABLE public.portal_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  payment_method text NOT NULL DEFAULT 'pix',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  negociarie_id_geral text,
  payment_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_payments ENABLE ROW LEVEL SECURITY;

-- Public read access via checkout_token (for portal users without auth)
CREATE POLICY "Public can view payments by checkout token"
ON public.portal_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.agreements a
    WHERE a.id = portal_payments.agreement_id
      AND a.checkout_token IS NOT NULL
  )
);

-- Service role full access
CREATE POLICY "Service role full access portal_payments"
ON public.portal_payments
FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Tenant users can view their tenant payments
CREATE POLICY "Tenant users can view portal payments"
ON public.portal_payments
FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- Tenant admins can manage portal payments
CREATE POLICY "Tenant admins can manage portal payments"
ON public.portal_payments
FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Add public read policy for agreements via checkout_token (for unauthenticated portal access)
CREATE POLICY "Public can view agreement by checkout token"
ON public.agreements
FOR SELECT
USING (checkout_token IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_portal_payments_updated_at
BEFORE UPDATE ON public.portal_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookup
CREATE INDEX idx_portal_payments_agreement_id ON public.portal_payments(agreement_id);
CREATE INDEX idx_agreements_checkout_token ON public.agreements(checkout_token) WHERE checkout_token IS NOT NULL;

-- Also add a public policy for tenants so portal can fetch tenant info by slug
CREATE POLICY "Public can view tenant by slug"
ON public.tenants
FOR SELECT
USING (true);
