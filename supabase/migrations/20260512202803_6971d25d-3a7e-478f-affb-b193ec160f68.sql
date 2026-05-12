CREATE TABLE public.support_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('suporte','financeiro')),
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_select_own_ai_conv"
  ON public.support_ai_conversations
  FOR SELECT
  USING (user_id = auth.uid() AND tenant_id = public.get_my_tenant_id());

CREATE POLICY "user_insert_own_ai_conv"
  ON public.support_ai_conversations
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_my_tenant_id());

CREATE POLICY "user_delete_own_ai_conv"
  ON public.support_ai_conversations
  FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_support_ai_conv_user_created
  ON public.support_ai_conversations (user_id, created_at DESC);