CREATE OR REPLACE FUNCTION public.get_client_consolidated_status(
  _tenant_id uuid,
  _cpf text,
  _credor text,
  _atraso_quebra_dias int DEFAULT 15
) RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cpf_norm text := regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g');
  _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _worst_agreement_state text := NULL;
  _has_clients_rows bool := false;
  _has_open_debt bool := false;
  _has_overdue_debt bool := false;
BEGIN
  WITH ag AS (
    SELECT a.id, a.status AS agreement_status
    FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND regexp_replace(a.client_cpf, '\D', '', 'g') = _cpf_norm
      AND a.credor = _credor
      AND a.status IN ('pending', 'approved', 'cancelled', 'completed')
  ),
  state_per_agreement AS (
    SELECT
      ag.id,
      ag.agreement_status,
      COUNT(*) FILTER (WHERE NOT ai.cancelled) AS total_active,
      COUNT(*) FILTER (WHERE NOT ai.cancelled AND ai.paid) AS paid_active,
      COUNT(*) FILTER (WHERE NOT ai.cancelled AND NOT ai.paid AND ai.due_date < _today) AS overdue_active,
      MAX(_today - ai.due_date) FILTER (WHERE NOT ai.cancelled AND NOT ai.paid AND ai.due_date < _today) AS max_overdue_days
    FROM ag
    LEFT JOIN agreement_installments ai ON ai.agreement_id = ag.id
    GROUP BY ag.id, ag.agreement_status
  ),
  classified AS (
    SELECT
      CASE
        WHEN agreement_status = 'cancelled' THEN 'quebra_acordo'
        WHEN agreement_status = 'completed' THEN 'quitado'
        WHEN total_active = 0 THEN NULL
        WHEN paid_active = total_active THEN 'quitado'
        WHEN overdue_active > 0 AND COALESCE(max_overdue_days, 0) > _atraso_quebra_dias THEN 'quebra_acordo'
        WHEN overdue_active > 0 THEN 'acordo_atrasado'
        ELSE 'acordo_vigente'
      END AS state
    FROM state_per_agreement
  )
  SELECT
    CASE
      WHEN bool_or(state = 'quebra_acordo') THEN 'quebra_acordo'
      WHEN bool_or(state = 'acordo_atrasado') THEN 'acordo_atrasado'
      WHEN bool_or(state = 'acordo_vigente') THEN 'acordo_vigente'
      WHEN bool_or(state = 'quitado') THEN 'quitado'
      ELSE NULL
    END
  INTO _worst_agreement_state
  FROM classified;

  -- agreement-derived state (other than quitado) dominates
  IF _worst_agreement_state IS NOT NULL AND _worst_agreement_state <> 'quitado' THEN
    RETURN _worst_agreement_state;
  END IF;

  -- look at raw debt
  SELECT
    bool_or(true),
    bool_or(c.status NOT IN ('pago')),
    bool_or(c.status NOT IN ('pago') AND c.data_vencimento < _today)
  INTO _has_clients_rows, _has_open_debt, _has_overdue_debt
  FROM clients c
  WHERE c.tenant_id = _tenant_id
    AND regexp_replace(c.cpf, '\D', '', 'g') = _cpf_norm
    AND c.credor = _credor;

  IF NOT COALESCE(_has_open_debt, false) THEN
    -- nothing open: if there were rows or quitado agreement → quitado, else em_dia
    IF COALESCE(_has_clients_rows, false) OR _worst_agreement_state = 'quitado' THEN
      RETURN 'quitado';
    END IF;
    RETURN 'em_dia';
  END IF;

  IF _has_overdue_debt THEN
    RETURN 'inadimplente';
  END IF;

  RETURN 'em_dia';
END;
$$;