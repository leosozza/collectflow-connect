
CREATE TABLE public.conversation_disposition_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  disposition_type_id uuid NOT NULL REFERENCES public.call_disposition_types(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, disposition_type_id)
);

ALTER TABLE public.conversation_disposition_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage disposition assignments"
  ON public.conversation_disposition_assignments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
