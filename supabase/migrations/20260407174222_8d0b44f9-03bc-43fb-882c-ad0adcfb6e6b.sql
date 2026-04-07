
-- Step 1: Clean duplicate conversations - keep the one with latest last_message_at, move messages
DO $$
DECLARE
  _dup record;
  _keep_id uuid;
  _delete_ids uuid[];
BEGIN
  FOR _dup IN
    SELECT tenant_id, instance_id, remote_phone
    FROM conversations
    GROUP BY tenant_id, instance_id, remote_phone
    HAVING count(*) > 1
  LOOP
    -- Keep the one with most recent activity
    SELECT id INTO _keep_id
    FROM conversations
    WHERE tenant_id = _dup.tenant_id
      AND instance_id = _dup.instance_id
      AND remote_phone = _dup.remote_phone
    ORDER BY last_message_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
    
    -- Get IDs to delete
    SELECT array_agg(id) INTO _delete_ids
    FROM conversations
    WHERE tenant_id = _dup.tenant_id
      AND instance_id = _dup.instance_id
      AND remote_phone = _dup.remote_phone
      AND id != _keep_id;
    
    -- Move messages from duplicates to keeper
    UPDATE chat_messages
    SET conversation_id = _keep_id
    WHERE conversation_id = ANY(_delete_ids);
    
    -- Delete tag assignments from duplicates
    DELETE FROM conversation_tag_assignments
    WHERE conversation_id = ANY(_delete_ids);
    
    -- Delete disposition assignments from duplicates
    DELETE FROM conversation_disposition_assignments
    WHERE conversation_id = ANY(_delete_ids);
    
    -- Delete duplicate conversations
    DELETE FROM conversations
    WHERE id = ANY(_delete_ids);
  END LOOP;
END $$;

-- Step 2: Add UNIQUE constraint on conversations
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_tenant_instance_phone 
  ON public.conversations (tenant_id, instance_id, remote_phone);

-- Step 3: Add partial UNIQUE constraint on chat_messages external_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_messages_tenant_external_id 
  ON public.chat_messages (tenant_id, external_id) 
  WHERE external_id IS NOT NULL;
