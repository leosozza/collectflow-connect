
-- Step 1: Create denormalization trigger function
CREATE OR REPLACE FUNCTION public.trg_denormalize_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_internal = false THEN
    UPDATE public.conversations
    SET 
      last_message_content = LEFT(NEW.content, 200),
      last_message_type = NEW.message_type,
      last_message_direction = NEW.direction,
      last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 2: Create trigger
DROP TRIGGER IF EXISTS trg_chat_msg_denormalize ON public.chat_messages;
CREATE TRIGGER trg_chat_msg_denormalize
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_denormalize_last_message();

-- Step 3: Backfill endpoint_id and provider on existing conversations
UPDATE public.conversations c
SET 
  endpoint_id = c.instance_id,
  provider = wi.provider
FROM public.whatsapp_instances wi
WHERE c.instance_id = wi.id
  AND c.endpoint_id IS NULL;

-- Step 4: Backfill last_message_* from existing chat_messages
UPDATE public.conversations c
SET
  last_message_content = sub.content,
  last_message_type = sub.message_type,
  last_message_direction = sub.direction
FROM (
  SELECT DISTINCT ON (cm.conversation_id)
    cm.conversation_id,
    LEFT(cm.content, 200) AS content,
    cm.message_type,
    cm.direction
  FROM public.chat_messages cm
  WHERE cm.is_internal = false
  ORDER BY cm.conversation_id, cm.created_at DESC
) sub
WHERE c.id = sub.conversation_id
  AND c.last_message_content IS NULL;
