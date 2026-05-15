CREATE OR REPLACE FUNCTION public.get_client_consolidated_status(_tenant_id uuid, _cpf text, _credor text, _atraso_quebra_dias integer DEFAULT NULL::integer)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cpf_norm text := regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g');
  _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _prazo int;
  _ag_state text := NULL;
  _has_clients_rows bool := false;
  _has_open_debt bool := false;
  _has_overdue_debt bool := false;
BEGIN
  IF _atraso_quebra_dias IS NULL THEN
    SELECT COALESCE(c.prazo_dias_acordo, 10) INTO _prazo
    FROM credores c
    WHERE c.tenant_id = _tenant_id
      AND (c.razao_social = _credor OR c.nome_fantasia = _credor)
    LIMIT 1;
    _prazo := COALESCE(_prazo, 10);
  ELSE
    _prazo := _atraso_quebra_dias;
  END IF;

  WITH ag AS (
    SELECT a.id, a.status AS agreement_status
    FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND regexp_replace(a.client_cpf, '\D', '', 'g') = _cpf_norm
      AND a.credor = _credor
      AND a.status IN ('pending', 'approved', 'completed', 'cancelled')
  ),
  per_ag AS (
    SELECT ag.id, ag.agreement_status,
      COUNT(*) FILTER (WHERE NOT ai.cancelled) AS total_active,
      COUNT(*) FILTER (WHERE NOT ai.cancelled AND ai.paid) AS paid_active,
      COUNT(*) FILTER (WHERE NOT ai.cancelled AND NOT ai.paid AND ai.due_date < _today) AS overdue_active,
      MAX(_today - ai.due_date) FILTER (WHERE NOT ai.cancelled AND NOT ai.paid AND ai.due_date < _today) AS max_overdue_days
    FROM ag LEFT JOIN agreement_installments ai ON ai.agreement_id = ag.id
    GROUP BY ag.id, ag.agreement_status
  ),
  classified AS (
    SELECT CASE
      WHEN agreement_status = 'completed' THEN 'acordo_quitado'
      WHEN total_active > 0 AND paid_active = total_active THEN 'acordo_quitado'
      WHEN agreement_status = 'cancelled' THEN 'acordo_cancelado'
      WHEN overdue_active > 0 AND COALESCE(max_overdue_days, 0) > _prazo THEN 'acordo_cancelado'
      WHEN overdue_active > 0 THEN 'acordo_atrasado'
      WHEN agreement_status IN ('pending','approved') THEN 'acordo_vigente'
      ELSE NULL
    END AS state
    FROM per_ag
  )
  SELECT CASE
    WHEN bool_or(state = 'acordo_vigente')   THEN 'acordo_vigente'
    WHEN bool_or(state = 'acordo_atrasado')  THEN 'acordo_atrasado'
    WHEN bool_or(state = 'acordo_cancelado') THEN 'acordo_cancelado'
    WHEN bool_or(state = 'acordo_quitado')   THEN 'acordo_quitado'
    ELSE NULL END
  INTO _ag_state FROM classified;

  IF _ag_state IS NOT NULL THEN RETURN _ag_state; END IF;

  SELECT
    bool_or(true),
    bool_or(c.status NOT IN ('pago', 'cancelado_maxlist')),
    bool_or(c.status NOT IN ('pago', 'cancelado_maxlist') AND c.data_vencimento < _today)
  INTO _has_clients_rows, _has_open_debt, _has_overdue_debt
  FROM clients c
  WHERE c.tenant_id = _tenant_id
    AND regexp_replace(c.cpf, '\D', '', 'g') = _cpf_norm
    AND c.credor = _credor;

  IF NOT COALESCE(_has_clients_rows, false) THEN RETURN 'em_dia'; END IF;
  IF NOT COALESCE(_has_open_debt, false) THEN RETURN 'quitado'; END IF;
  IF _has_overdue_debt THEN RETURN 'inadimplente'; END IF;
  RETURN 'em_dia';
END;
$function$;