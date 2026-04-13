
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid, int, int);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _user_id uuid DEFAULT NULL,
  _year int DEFAULT NULL,
  _month int DEFAULT NULL
)
RETURNS TABLE(
  total_projetado numeric,
  total_negociado numeric,
  total_negociado_mes numeric,
  total_recebido numeric,
  total_quebra numeric,
  total_pendente numeric,
  acordos_dia bigint,
  acordos_mes bigint,
  total_quitados numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _now timestamp with time zone := now();
  _target_year int := COALESCE(_year, EXTRACT(YEAR FROM _now)::int);
  _target_month int := COALESCE(_month, EXTRACT(MONTH FROM _now)::int);
  _month_start date;
  _month_end date;
  _today date := CURRENT_DATE;
  _projetado numeric := 0;
  _negociado numeric := 0;
  _negociado_mes numeric := 0;
  _recebido numeric := 0;
  _quebra numeric := 0;
  _pendente numeric := 0;
  _quitados numeric := 0;
  _dia bigint := 0;
  _mes bigint := 0;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint, 0::numeric;
    RETURN;
  END IF;

  _month_start := make_date(_target_year, _target_month, 1);
  _month_end := (_month_start + interval '1 month' - interval '1 day')::date;

  -- PROJETADO
  SELECT COALESCE(SUM(parcela_valor), 0) INTO _projetado
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved')
      AND a.created_at::date < _month_start
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start
      AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved')
      AND a.created_at::date < _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  -- NEGOCIADO (primeira parcela)
  SELECT COALESCE(SUM(
    CASE WHEN a.entrada_value > 0
      THEN COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value)
      ELSE COALESCE((a.custom_installment_values->>'1')::numeric, a.new_installment_value)
    END
  ), 0) INTO _negociado
  FROM agreements a
  WHERE a.tenant_id = _tenant
    AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR a.created_by = _user_id);

  -- NEGOCIADO MES (total)
  SELECT COALESCE(SUM(parcela_valor), 0) INTO _negociado_mes
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status NOT IN ('cancelled', 'rejected')
      AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
      AND a.entrada_value > 0
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status NOT IN ('cancelled', 'rejected')
      AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  -- RECEBIDO
  SELECT COALESCE(SUM(
    COALESCE(
      (ce.metadata->>'valor_pago')::numeric,
      (ce.metadata->>'amount_paid')::numeric,
      0
    )
  ), 0) INTO _recebido
  FROM client_events ce
  WHERE ce.tenant_id = _tenant
    AND ce.event_type IN ('payment_confirmed', 'manual_payment_confirmed')
    AND ce.created_at::date >= _month_start
    AND ce.created_at::date <= _month_end
    AND (
      _user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM agreements a
        WHERE a.id = (ce.metadata->>'agreement_id')::uuid
          AND a.created_by = _user_id
      )
    );

  -- QUEBRA
  SELECT COALESCE(SUM(parcela_valor), 0) INTO _quebra
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status = 'cancelled'
      AND a.cancellation_type = 'auto_expired'
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start
      AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status = 'cancelled'
      AND a.cancellation_type = 'auto_expired'
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  -- PENDENTE (apenas acordos ativos, sem completed)
  SELECT COALESCE(SUM(parcela_valor), 0) INTO _pendente
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved', 'overdue')
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start
      AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved', 'overdue')
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  _pendente := GREATEST(_pendente - _recebido, 0);

  -- QUITADOS NO MÊS (valor total dos acordos completed no mês)
  SELECT COALESCE(SUM(a.proposed_total), 0) INTO _quitados
  FROM agreements a
  WHERE a.tenant_id = _tenant
    AND a.status = 'completed'
    AND a.updated_at::date >= _month_start AND a.updated_at::date <= _month_end
    AND (_user_id IS NULL OR a.created_by = _user_id);

  SELECT COUNT(*) INTO _dia
  FROM agreements
  WHERE tenant_id = _tenant
    AND created_at::date = _today
    AND status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR created_by = _user_id);

  SELECT COUNT(*) INTO _mes
  FROM agreements
  WHERE tenant_id = _tenant
    AND created_at::date >= _month_start AND created_at::date <= _month_end
    AND status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR created_by = _user_id);

  RETURN QUERY SELECT _projetado, _negociado, _negociado_mes, _recebido, _quebra, _pendente, _dia, _mes, _quitados;
END;
$$;
