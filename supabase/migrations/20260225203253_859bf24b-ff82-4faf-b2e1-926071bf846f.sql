
-- Tabela de tickets de suporte
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

CREATE POLICY "Users can create tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

CREATE POLICY "Users can update own tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

CREATE POLICY "Super admin can manage all tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de mensagens do ticket
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages of own tickets" ON public.support_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id
      AND t.user_id = auth.uid()
      AND t.tenant_id = get_my_tenant_id()
  ));

CREATE POLICY "Users can insert messages on own tickets" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id
      AND t.user_id = auth.uid()
      AND t.tenant_id = get_my_tenant_id()
  ));

CREATE POLICY "Super admin can manage all messages" ON public.support_messages
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Tabela de agendamentos
CREATE TABLE public.support_schedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  preferred_date TIMESTAMPTZ NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_schedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule requests" ON public.support_schedule_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

CREATE POLICY "Users can create schedule requests" ON public.support_schedule_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

CREATE POLICY "Super admin can manage all schedule requests" ON public.support_schedule_requests
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Habilitar realtime para mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
