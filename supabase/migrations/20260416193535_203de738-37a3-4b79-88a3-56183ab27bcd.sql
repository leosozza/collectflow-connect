-- Phase 5: Auto-close interno configurável

-- 1) Coluna last_interaction_at em conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

-- Backfill com last_message_at existente
UPDATE public.conversations
SET last_interaction_at = COALESCE(last_message_at, updated_at, created_at)
WHERE last_interaction_at IS NULL;

-- Índice para o runner
CREATE INDEX IF NOT EXISTS idx_conversations_autoclose
  ON public.conversations (tenant_id, status, last_interaction_at);

-- 2) Trigger para atualizar last_interaction_at em chat_messages insert (não-internas)
CREATE OR REPLACE FUNCTION public.update_conversation_last_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_internal = false THEN
    UPDATE public.conversations
    SET last_interaction_at = NEW.created_at
    WHERE id = NEW.conversation_id
      AND (last_interaction_at IS NULL OR last_interaction_at < NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conv_last_interaction ON public.chat_messages;
CREATE TRIGGER trg_update_conv_last_interaction
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_interaction();

-- 3) Settings em tenants.settings (JSONB já existente)
-- Estrutura sugerida:
-- settings.whatsapp_autoclose = {
--   "enabled": false,
--   "inactivity_hours": 24,
--   "applies_to_statuses": ["open"],
--   "applies_to_official": true,
--   "applies_to_unofficial": true
-- }
-- Nenhuma alteração estrutural — apenas convenção JSON.

-- 4) Garantir que disposição "auto_close" exista por tenant (criada on-demand pela edge function).
-- Não criar agora; será inserida quando o runner rodar pela primeira vez no tenant.