
-- Create agreement_signatures table
CREATE TABLE public.agreement_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_id UUID NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  signature_type TEXT NOT NULL DEFAULT 'click',
  signature_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.agreement_signatures ENABLE ROW LEVEL SECURITY;

-- Public can view signatures if agreement has checkout_token
CREATE POLICY "Public can view signatures by checkout token"
ON public.agreement_signatures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.agreements a
    WHERE a.id = agreement_signatures.agreement_id
    AND a.checkout_token IS NOT NULL
  )
);

-- Service role full access
CREATE POLICY "Service role full access agreement_signatures"
ON public.agreement_signatures
FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Tenant admins can view
CREATE POLICY "Tenant admins can view signatures"
ON public.agreement_signatures
FOR SELECT
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Tenant users can view
CREATE POLICY "Tenant users can view signatures"
ON public.agreement_signatures
FOR SELECT
USING (tenant_id = get_my_tenant_id());

-- Create private storage bucket for signature files
INSERT INTO storage.buckets (id, name, public) VALUES ('agreement-signatures', 'agreement-signatures', false);

-- Service role can manage files in agreement-signatures bucket
CREATE POLICY "Service role manages signature files"
ON storage.objects
FOR ALL
USING (bucket_id = 'agreement-signatures' AND auth.role() = 'service_role'::text)
WITH CHECK (bucket_id = 'agreement-signatures' AND auth.role() = 'service_role'::text);

-- Tenant admins can view signature files
CREATE POLICY "Tenant admins can view signature files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'agreement-signatures' AND auth.role() = 'authenticated'::text);
