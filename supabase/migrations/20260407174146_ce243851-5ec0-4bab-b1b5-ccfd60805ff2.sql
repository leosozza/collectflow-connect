
-- Add multiprovider columns to conversations
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS channel_type text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS endpoint_id uuid,
  ADD COLUMN IF NOT EXISTS last_message_content text,
  ADD COLUMN IF NOT EXISTS last_message_type text,
  ADD COLUMN IF NOT EXISTS last_message_direction text;

-- Add multiprovider columns to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS endpoint_id uuid,
  ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'human';
