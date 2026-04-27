CREATE OR REPLACE FUNCTION public.get_acionados_hoje(_user_id uuid DEFAULT NULL::uuid, _tenant_id uuid DEFAULT NULL::uuid, _user_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_count bigint;
  v_no_op_filter boolean;
BEGIN
  v_tenant_id := COALESCE(_tenant_id, public.get_my_tenant_id());

  IF v_tenant_id IS NULL THEN
    RETURN 0;
  END IF;

  v_no_op_filter := (_user_id IS NULL AND (_user_ids IS NULL OR array_length(_user_ids, 1) IS NULL));

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
      AND (v_no_op_filter OR ual.user_id = _user_id OR ual.user_id = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ),
  agreed_today AS (
    SELECT DISTINCT regexp_replace(a.client_cpf, '\D', '', 'g') AS cpf
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND a.created_at >= date_trunc('day', now())
      AND a.created_at <  date_trunc('day', now()) + interval '1 day'
      AND (v_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ),
  active_agreements_cpfs AS (
    SELECT DISTINCT regexp_replace(a.client_cpf, '\D', '', 'g') AS cpf
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND a.status IN ('approved', 'overdue')
  )
  SELECT COUNT(*) INTO v_count
  FROM visited_cpfs v
  WHERE v.cpf <> ''
    AND length(v.cpf) >= 11
    AND NOT EXISTS (SELECT 1 FROM agreed_today a WHERE a.cpf = v.cpf)
    AND NOT EXISTS (SELECT 1 FROM active_agreements_cpfs aa WHERE aa.cpf = v.cpf);

  RETURN COALESCE(v_count, 0);
END;
$function$;