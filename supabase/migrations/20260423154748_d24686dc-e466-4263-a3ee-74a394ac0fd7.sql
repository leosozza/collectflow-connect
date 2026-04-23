-- Add edit/delete columns to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS deleted_for_recipient_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_content text;

-- Allow authors or tenant admins to UPDATE chat_messages (for edit/delete-for-recipient flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'chat_messages_update_author_or_admin'
  ) THEN
    CREATE POLICY "chat_messages_update_author_or_admin"
      ON public.chat_messages
      FOR UPDATE
      TO authenticated
      USING (
        tenant_id = public.get_my_tenant_id()
        AND (
          public.is_tenant_admin(auth.uid(), tenant_id)
          OR (
            (metadata->>'sent_by_user_id')::uuid = auth.uid()
          )
          OR (
            (metadata->>'sent_by_profile_id')::uuid IN (
              SELECT id FROM public.profiles WHERE user_id = auth.uid()
            )
          )
        )
      )
      WITH CHECK (
        tenant_id = public.get_my_tenant_id()
      );
  END IF;
END$$;