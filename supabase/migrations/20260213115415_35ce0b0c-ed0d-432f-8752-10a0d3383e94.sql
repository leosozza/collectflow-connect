
-- Add external_id to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS external_id text;

-- Create call_dispositions table
CREATE TABLE public.call_dispositions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  operator_id uuid NOT NULL,
  disposition_type text NOT NULL,
  notes text,
  scheduled_callback timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_dispositions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can view dispositions"
  ON public.call_dispositions FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can insert dispositions"
  ON public.call_dispositions FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant admins can update dispositions"
  ON public.call_dispositions FOR UPDATE
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can delete dispositions"
  ON public.call_dispositions FOR DELETE
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Index for performance
CREATE INDEX idx_call_dispositions_client_id ON public.call_dispositions(client_id);
CREATE INDEX idx_call_dispositions_tenant_id ON public.call_dispositions(tenant_id);
CREATE INDEX idx_call_dispositions_operator_id ON public.call_dispositions(operator_id);
