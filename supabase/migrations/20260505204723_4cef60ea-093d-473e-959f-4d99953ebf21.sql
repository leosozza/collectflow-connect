ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chat_messages_reactions_gin
  ON public.chat_messages USING gin (reactions);