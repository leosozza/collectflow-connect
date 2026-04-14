CREATE OR REPLACE FUNCTION public.get_distinct_event_cpfs(p_tenant_id uuid, p_since timestamptz)
RETURNS TABLE(cpf text) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT regexp_replace(client_cpf, '\D', '', 'g') as cpf
  FROM public.client_events
  WHERE tenant_id = p_tenant_id
    AND created_at >= p_since
    AND client_cpf IS NOT NULL
    AND client_cpf != ''
$$;