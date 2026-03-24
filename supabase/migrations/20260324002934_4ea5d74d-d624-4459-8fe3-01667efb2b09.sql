
-- Fase 1: Create atendimento_sessions table
CREATE TABLE public.atendimento_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid REFERENCES clients(id),
  client_cpf text NOT NULL,
  credor text,
  status text NOT NULL DEFAULT 'open',
  origin_channel text NOT NULL,
  current_channel text,
  origin_actor text,
  current_actor text,
  assigned_to uuid REFERENCES profiles(id),
  source_conversation_id uuid,
  source_call_id text,
  portal_session_id text,
  ai_session_id text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index: 1 active session per tenant+client+credor
CREATE UNIQUE INDEX idx_active_session ON atendimento_sessions (tenant_id, client_id, credor)
  WHERE status = 'open';

ALTER TABLE atendimento_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage sessions"
  ON atendimento_sessions FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- Fase 2: Add session_id to client_events
ALTER TABLE client_events ADD COLUMN session_id uuid REFERENCES atendimento_sessions(id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimento_sessions;
