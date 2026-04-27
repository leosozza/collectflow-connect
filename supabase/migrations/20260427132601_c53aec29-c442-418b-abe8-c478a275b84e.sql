-- Tabela de log bruto dos eventos do Socket.IO da 3CPLUS
CREATE TABLE IF NOT EXISTS public.threecplus_socket_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  event_name text NOT NULL,
  external_company_id text,
  external_agent_id text,
  external_call_id text,
  external_campaign_id text,
  phone text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_status text NOT NULL DEFAULT 'pending',
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_threecplus_events_tenant_received
  ON public.threecplus_socket_events (tenant_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_threecplus_events_tenant_call
  ON public.threecplus_socket_events (tenant_id, external_call_id)
  WHERE external_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_threecplus_events_tenant_event
  ON public.threecplus_socket_events (tenant_id, event_name);

-- Dedup parcial: mesmo (tenant, event, call) só entra uma vez por status
CREATE UNIQUE INDEX IF NOT EXISTS uq_threecplus_events_dedup
  ON public.threecplus_socket_events (
    tenant_id,
    event_name,
    external_call_id,
    (payload->>'status')
  )
  WHERE external_call_id IS NOT NULL;

ALTER TABLE public.threecplus_socket_events ENABLE ROW LEVEL SECURITY;

-- Leitura: usuários do mesmo tenant
CREATE POLICY "tenant members can read 3cplus socket events"
ON public.threecplus_socket_events
FOR SELECT
TO authenticated
USING (tenant_id = public.get_my_tenant_id());

-- Insert: usuários do mesmo tenant (evento gravado pelo frontend ou edge ingest)
CREATE POLICY "tenant members can insert 3cplus socket events"
ON public.threecplus_socket_events
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Sem update/delete para operadores; manutenção fica a cargo de service role.