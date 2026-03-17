
-- Create call_logs table for storing 3CPlus call recordings
CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_cpf text,
  phone text,
  agent_name text,
  operator_id text,
  call_id_external text,
  status text,
  duration_seconds int DEFAULT 0,
  recording_url text,
  campaign_name text,
  called_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Tenant users can view call logs from their tenant
CREATE POLICY "Tenant users can view call_logs"
  ON public.call_logs FOR SELECT
  TO authenticated
  USING (tenant_id = (SELECT get_my_tenant_id()));

-- Tenant users can insert call logs for their tenant
CREATE POLICY "Tenant users can insert call_logs"
  ON public.call_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (SELECT get_my_tenant_id()));

-- Index for fast lookups by client_cpf
CREATE INDEX idx_call_logs_tenant_cpf ON public.call_logs (tenant_id, client_cpf);
CREATE INDEX idx_call_logs_client_id ON public.call_logs (client_id);
