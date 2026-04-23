CREATE OR REPLACE FUNCTION public.get_acionados_hoje(
  _user_id uuid DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_count bigint;
BEGIN
  v_tenant_id := COALESCE(_tenant_id, public.get_my_tenant_id());
  v_user_id := _user_id;

  IF v_tenant_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH visited_cpfs AS (
    SELECT DISTINCT
      regexp_replace(
        COALESCE(NULLIF(split_part(ual.page_path, '/', 3), ''), ''),
        '\D', '', 'g'
      ) AS cpf
    FROM public.user_activity_logs ual
    WHERE ual.tenant_id = v_tenant_id
      AND ual.created_at >= date_trunc('day', now())
      AND ual.created_at < date_trunc('day', now()) + interval '1 day'
      AND ual.activity_type = 'page_view'
      AND (ual.page_path LIKE '/carteira/%' OR ual.page_path LIKE '/atendimento/%')
      AND (v_user_id IS NULL OR ual.user_id = v_user_id)
  ),
  agreed_today AS (
    SELECT DISTINCT regexp_replace(a.client_cpf, '\D', '', 'g') AS cpf
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND a.created_at >= date_trunc('day', now())
      AND a.created_at <  date_trunc('day', now()) + interval '1 day'
      AND (v_user_id IS NULL OR a.created_by = v_user_id)
  )
  SELECT COUNT(*) INTO v_count
  FROM visited_cpfs v
  WHERE v.cpf <> ''
    AND length(v.cpf) >= 11
    AND NOT EXISTS (SELECT 1 FROM agreed_today a WHERE a.cpf = v.cpf);

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_acionados_hoje(uuid, uuid) TO authenticated;