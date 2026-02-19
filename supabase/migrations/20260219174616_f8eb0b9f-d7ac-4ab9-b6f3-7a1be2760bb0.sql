
-- Create workflow_flows table
CREATE TABLE public.workflow_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT false,
  nodes jsonb DEFAULT '[]'::jsonb,
  edges jsonb DEFAULT '[]'::jsonb,
  trigger_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create workflow_executions table
CREATE TABLE public.workflow_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  workflow_id uuid NOT NULL REFERENCES public.workflow_flows(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  current_node_id text,
  status text NOT NULL DEFAULT 'running',
  execution_log jsonb DEFAULT '[]'::jsonb,
  next_run_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS for workflow_flows
CREATE POLICY "Tenant admins can manage workflow_flows"
ON public.workflow_flows FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view workflow_flows"
ON public.workflow_flows FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- RLS for workflow_executions
CREATE POLICY "Tenant admins can manage workflow_executions"
ON public.workflow_executions FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view workflow_executions"
ON public.workflow_executions FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- Service role access for edge functions
CREATE POLICY "Service role full access workflow_flows"
ON public.workflow_flows FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access workflow_executions"
ON public.workflow_executions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Trigger for updated_at on workflow_flows
CREATE TRIGGER update_workflow_flows_updated_at
BEFORE UPDATE ON public.workflow_flows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for CRON resume queries
CREATE INDEX idx_workflow_executions_waiting ON public.workflow_executions (next_run_at, status) WHERE status = 'waiting';
CREATE INDEX idx_workflow_flows_active ON public.workflow_flows (tenant_id, is_active) WHERE is_active = true;
