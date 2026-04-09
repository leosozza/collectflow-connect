CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  function_name TEXT NOT NULL DEFAULT 'gupshup-webhook',
  event_type TEXT NOT NULL DEFAULT 'info',
  message TEXT,
  payload JSONB,
  status_code INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read webhook logs for their tenant"
  ON public.webhook_logs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = webhook_logs.tenant_id));

CREATE INDEX idx_webhook_logs_tenant_created ON public.webhook_logs (tenant_id, created_at DESC);
CREATE INDEX idx_webhook_logs_function ON public.webhook_logs (function_name);