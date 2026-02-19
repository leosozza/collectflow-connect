
-- Table to track mailing import history
CREATE TABLE public.import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  api_key_id UUID REFERENCES public.api_keys(id),
  source TEXT NOT NULL DEFAULT 'api', -- 'api' | 'spreadsheet'
  total_records INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  credor TEXT,
  imported_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view import logs"
ON public.import_logs FOR SELECT
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view own import logs"
ON public.import_logs FOR SELECT
USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can insert import logs"
ON public.import_logs FOR INSERT
WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Service role full access import_logs"
ON public.import_logs FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_import_logs_tenant_created ON public.import_logs(tenant_id, created_at DESC);
