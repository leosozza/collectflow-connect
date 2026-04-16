CREATE OR REPLACE FUNCTION public.get_other_active_conversations(
  _client_id UUID,
  _exclude_conv_id UUID,
  _window_hours INTEGER DEFAULT 48
)
RETURNS TABLE (
  conversation_id UUID,
  instance_id UUID,
  instance_name TEXT,
  remote_phone TEXT,
  status TEXT,
  assigned_to UUID,
  assigned_name TEXT,
  last_interaction_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS conversation_id,
    COALESCE(c.endpoint_id, c.instance_id) AS instance_id,
    wi.instance_name,
    c.remote_phone,
    c.status,
    c.assigned_to,
    p.full_name AS assigned_name,
    COALESCE(c.last_interaction_at, c.last_message_at, c.updated_at) AS last_interaction_at
  FROM public.conversations c
  LEFT JOIN public.whatsapp_instances wi
    ON wi.id = COALESCE(c.endpoint_id, c.instance_id)
  LEFT JOIN public.profiles p
    ON p.id = c.assigned_to
  WHERE c.client_id = _client_id
    AND c.id <> _exclude_conv_id
    AND (
      c.status IN ('open', 'waiting')
      OR COALESCE(c.last_interaction_at, c.last_message_at, c.updated_at)
         > (now() - make_interval(hours => _window_hours))
    )
  ORDER BY COALESCE(c.last_interaction_at, c.last_message_at, c.updated_at) DESC NULLS LAST
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_other_active_conversations(UUID, UUID, INTEGER) TO authenticated;