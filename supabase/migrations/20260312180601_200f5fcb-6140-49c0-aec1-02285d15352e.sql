
-- Create enrichment_jobs table
CREATE TABLE public.enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  total_clients INT NOT NULL DEFAULT 0,
  cost_per_client NUMERIC NOT NULL DEFAULT 0.15,
  status TEXT NOT NULL DEFAULT 'pending',
  processed INT NOT NULL DEFAULT 0,
  enriched INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create enrichment_logs table
CREATE TABLE public.enrichment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.enrichment_jobs(id) ON DELETE CASCADE,
  cpf TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  data_returned JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for enrichment_jobs
CREATE POLICY "Tenant users can select enrichment_jobs"
  ON public.enrichment_jobs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can insert enrichment_jobs"
  ON public.enrichment_jobs FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can update enrichment_jobs"
  ON public.enrichment_jobs FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- RLS policies for enrichment_logs (access via job's tenant_id)
CREATE POLICY "Tenant users can select enrichment_logs"
  ON public.enrichment_logs FOR SELECT TO authenticated
  USING (job_id IN (
    SELECT ej.id FROM public.enrichment_jobs ej
    JOIN public.tenant_users tu ON tu.tenant_id = ej.tenant_id
    WHERE tu.user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can insert enrichment_logs"
  ON public.enrichment_logs FOR INSERT TO authenticated
  WITH CHECK (job_id IN (
    SELECT ej.id FROM public.enrichment_jobs ej
    JOIN public.tenant_users tu ON tu.tenant_id = ej.tenant_id
    WHERE tu.user_id = auth.uid()
  ));

-- Updated_at trigger for enrichment_jobs
CREATE TRIGGER update_enrichment_jobs_updated_at
  BEFORE UPDATE ON public.enrichment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
