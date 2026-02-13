
-- Quick replies table
CREATE TABLE public.quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  shortcut TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage quick replies"
  ON public.quick_replies FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view quick replies"
  ON public.quick_replies FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE UNIQUE INDEX idx_quick_replies_tenant_shortcut ON public.quick_replies(tenant_id, shortcut);

-- Add is_internal flag to chat_messages for internal notes
ALTER TABLE public.chat_messages ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false;

-- Add SLA config to conversations
ALTER TABLE public.conversations ADD COLUMN sla_deadline_at TIMESTAMP WITH TIME ZONE;

-- Add SLA settings to tenants settings (default 30 min)
-- This will be stored in tenants.settings JSON field as sla_minutes

-- Trigger for quick_replies updated_at
CREATE TRIGGER update_quick_replies_updated_at
  BEFORE UPDATE ON public.quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for quick_replies
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_replies;
