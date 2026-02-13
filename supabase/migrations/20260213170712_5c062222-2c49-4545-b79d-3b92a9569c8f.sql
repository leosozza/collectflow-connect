
-- =============================================
-- Fase 1: conversations + chat_messages
-- =============================================

-- conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id),
  remote_phone TEXT NOT NULL,
  remote_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'closed')),
  assigned_to UUID REFERENCES public.profiles(id),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  unread_count INTEGER NOT NULL DEFAULT 0,
  client_id UUID REFERENCES public.clients(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker')),
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_conversations_tenant ON public.conversations(tenant_id);
CREATE INDEX idx_conversations_instance ON public.conversations(instance_id);
CREATE INDEX idx_conversations_phone ON public.conversations(remote_phone);
CREATE INDEX idx_conversations_status ON public.conversations(tenant_id, status);
CREATE INDEX idx_conversations_last_msg ON public.conversations(last_message_at DESC);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_messages_external ON public.chat_messages(external_id);

-- Updated_at trigger for conversations
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS for conversations
-- =============================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Admins see all tenant conversations
CREATE POLICY "Tenant admins can view all conversations"
  ON public.conversations FOR SELECT
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Operators see only conversations from their assigned instances
CREATE POLICY "Operators can view assigned instance conversations"
  ON public.conversations FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.operator_instances oi
      WHERE oi.profile_id = get_my_profile_id()
        AND oi.instance_id = conversations.instance_id
    )
  );

-- Tenant users can insert conversations
CREATE POLICY "Tenant users can insert conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

-- Tenant users can update conversations (status, assigned_to, etc.)
CREATE POLICY "Tenant users can update conversations"
  ON public.conversations FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

-- =============================================
-- RLS for chat_messages
-- =============================================
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Admins see all tenant messages
CREATE POLICY "Tenant admins can view all chat messages"
  ON public.chat_messages FOR SELECT
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Operators see messages from their assigned instance conversations
CREATE POLICY "Operators can view assigned instance messages"
  ON public.chat_messages FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.operator_instances oi ON oi.instance_id = c.instance_id
      WHERE c.id = chat_messages.conversation_id
        AND oi.profile_id = get_my_profile_id()
    )
  );

-- Tenant users can insert messages
CREATE POLICY "Tenant users can insert chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

-- Tenant users can update message status
CREATE POLICY "Tenant users can update chat messages"
  ON public.chat_messages FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

-- Service role full access (for webhook edge function)
CREATE POLICY "Service role full access conversations"
  ON public.conversations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access chat_messages"
  ON public.chat_messages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- Enable Realtime
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- =============================================
-- Storage bucket for chat media
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true);

CREATE POLICY "Tenant users can upload chat media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view chat media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-media');
