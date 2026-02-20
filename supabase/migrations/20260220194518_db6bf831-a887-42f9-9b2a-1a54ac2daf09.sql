
-- Make instance_id nullable to support ON DELETE SET NULL
ALTER TABLE public.conversations
  ALTER COLUMN instance_id DROP NOT NULL;

-- Drop the old FK constraint
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_instance_id_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES public.whatsapp_instances(id)
  ON DELETE SET NULL;
