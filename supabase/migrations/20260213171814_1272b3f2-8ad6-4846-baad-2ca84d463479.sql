
-- Conversation tags
CREATE TABLE public.conversation_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view tags" ON public.conversation_tags
  FOR SELECT USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tags" ON public.conversation_tags
  FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Allow operators to insert tags too
CREATE POLICY "Tenant users can insert tags" ON public.conversation_tags
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- Tag assignments
CREATE TABLE public.conversation_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.conversation_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, tag_id)
);

ALTER TABLE public.conversation_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view tag assignments" ON public.conversation_tag_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "Tenant users can manage tag assignments" ON public.conversation_tag_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.tenant_id = get_my_tenant_id()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.tenant_id = get_my_tenant_id()
    )
  );

-- Index for full-text search on chat_messages content
CREATE INDEX idx_chat_messages_content_search ON public.chat_messages USING gin(to_tsvector('portuguese', coalesce(content, '')));
