
-- Performance indexes for production readiness
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients(cpf);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_data_vencimento ON public.clients(tenant_id, data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_clients_external_id ON public.clients(tenant_id, external_id);
CREATE INDEX IF NOT EXISTS idx_clients_credor ON public.clients(tenant_id, credor);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_last_msg ON public.conversations(tenant_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_call_dispositions_client ON public.call_dispositions(client_id);
CREATE INDEX IF NOT EXISTS idx_call_dispositions_tenant ON public.call_dispositions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_agreements_client_cpf ON public.agreements(tenant_id, client_cpf);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON public.agreements(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_client_events_client ON public.client_events(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_events_tenant ON public.client_events(tenant_id, event_type);
