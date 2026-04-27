
-- =====================================================
-- 1) SSoT: get_operator_received_total
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_operator_received_total(
  _operator_user_id uuid,
  _start_date date,
  _end_date date,
  _credor_names text[] DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant uuid;
  _total numeric := 0;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN
    RETURN 0;
  END IF;

  _total :=
    COALESCE((
      SELECT SUM(mp.amount_paid)
      FROM public.manual_payments mp
      JOIN public.agreements a ON a.id = mp.agreement_id
      WHERE mp.tenant_id = _tenant
        AND mp.status IN ('confirmed','approved')
        AND mp.payment_date BETWEEN _start_date AND _end_date
        AND a.created_by = _operator_user_id
        AND (_credor_names IS NULL OR a.credor = ANY(_credor_names))
    ), 0)
    + COALESCE((
      SELECT SUM(pp.amount)
      FROM public.portal_payments pp
      JOIN public.agreements a ON a.id = pp.agreement_id
      WHERE pp.tenant_id = _tenant
        AND pp.status = 'paid'
        AND pp.updated_at >= _start_date::timestamptz
        AND pp.updated_at <  (_end_date + 1)::timestamptz
        AND a.created_by = _operator_user_id
        AND (_credor_names IS NULL OR a.credor = ANY(_credor_names))
    ), 0)
    + COALESCE((
      SELECT SUM(nc.valor_pago)
      FROM public.negociarie_cobrancas nc
      JOIN public.agreements a ON a.id = nc.agreement_id
      WHERE nc.tenant_id = _tenant
        AND nc.status = 'pago'
        AND nc.data_pagamento BETWEEN _start_date AND _end_date
        AND a.created_by = _operator_user_id
        AND (_credor_names IS NULL OR a.credor = ANY(_credor_names))
    ), 0);

  RETURN _total;
END;
$$;

-- =====================================================
-- 2) Ranking snapshot: usar a SSoT em vez de client_events
-- =====================================================
CREATE OR REPLACE FUNCTION public.recalculate_operator_gamification_snapshot(
  _operator_profile_id uuid,
  _year integer,
  _month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _operator_user_id uuid;
  _month_start date;
  _next_month date;
  _month_end date;
  _payments_count int := 0;
  _total_received numeric := 0;
  _agreements_count int := 0;
  _agreements_paid_count int := 0;
  _breaks_count int := 0;
  _achievements_count int := 0;
  _goal numeric := 0;
  _goal_reached boolean := false;
  _points int := 0;
  _sum numeric := 0;
  _r record;
  _metric_value numeric;
BEGIN
  SELECT p.tenant_id, p.user_id
  INTO _tenant_id, _operator_user_id
  FROM public.profiles p
  WHERE p.id = _operator_profile_id
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  IF NOT (
    _operator_user_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), _tenant_id)
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  _month_start := make_date(_year, _month, 1);
  _next_month := (_month_start + interval '1 month')::date;
  _month_end := (_next_month - 1)::date;

  IF _operator_user_id IS NOT NULL THEN
    -- TOTAL RECEBIDO: SSoT unificada (mesma fórmula do Dashboard)
    _total_received :=
      COALESCE((SELECT SUM(mp.amount_paid)
        FROM public.manual_payments mp
        JOIN public.agreements a ON a.id = mp.agreement_id
        WHERE mp.tenant_id = _tenant_id
          AND mp.status IN ('confirmed','approved')
          AND mp.payment_date BETWEEN _month_start AND _month_end
          AND a.created_by = _operator_user_id), 0)
      + COALESCE((SELECT SUM(pp.amount)
        FROM public.portal_payments pp
        JOIN public.agreements a ON a.id = pp.agreement_id
        WHERE pp.tenant_id = _tenant_id
          AND pp.status = 'paid'
          AND pp.updated_at >= _month_start::timestamptz
          AND pp.updated_at <  _next_month::timestamptz
          AND a.created_by = _operator_user_id), 0)
      + COALESCE((SELECT SUM(nc.valor_pago)
        FROM public.negociarie_cobrancas nc
        JOIN public.agreements a ON a.id = nc.agreement_id
        WHERE nc.tenant_id = _tenant_id
          AND nc.status = 'pago'
          AND nc.data_pagamento BETWEEN _month_start AND _month_end
          AND a.created_by = _operator_user_id), 0);

    -- payments_count: nº de transações que compõem o total recebido
    SELECT
      COALESCE((SELECT COUNT(*)
        FROM public.manual_payments mp
        JOIN public.agreements a ON a.id = mp.agreement_id
        WHERE mp.tenant_id = _tenant_id
          AND mp.status IN ('confirmed','approved')
          AND mp.payment_date BETWEEN _month_start AND _month_end
          AND a.created_by = _operator_user_id), 0)
      + COALESCE((SELECT COUNT(*)
        FROM public.portal_payments pp
        JOIN public.agreements a ON a.id = pp.agreement_id
        WHERE pp.tenant_id = _tenant_id
          AND pp.status = 'paid'
          AND pp.updated_at >= _month_start::timestamptz
          AND pp.updated_at <  _next_month::timestamptz
          AND a.created_by = _operator_user_id), 0)
      + COALESCE((SELECT COUNT(*)
        FROM public.negociarie_cobrancas nc
        JOIN public.agreements a ON a.id = nc.agreement_id
        WHERE nc.tenant_id = _tenant_id
          AND nc.status = 'pago'
          AND nc.data_pagamento BETWEEN _month_start AND _month_end
          AND a.created_by = _operator_user_id), 0)
    INTO _payments_count;

    SELECT COUNT(*) INTO _agreements_count
    FROM public.agreements
    WHERE tenant_id = _tenant_id
      AND created_by = _operator_user_id
      AND status NOT IN ('cancelled', 'rejected')
      AND created_at >= _month_start
      AND created_at < _next_month;

    SELECT COUNT(*) INTO _agreements_paid_count
    FROM public.agreements a
    WHERE a.tenant_id = _tenant_id
      AND a.created_by = _operator_user_id
      AND a.status = 'completed'
      AND a.updated_at >= _month_start
      AND a.updated_at < _next_month;

    SELECT COUNT(*) INTO _breaks_count
    FROM public.agreements
    WHERE tenant_id = _tenant_id
      AND created_by = _operator_user_id
      AND status = 'cancelled'
      AND updated_at >= _month_start
      AND updated_at < _next_month;
  END IF;

  SELECT COUNT(*) INTO _achievements_count
  FROM public.achievements
  WHERE profile_id = _operator_profile_id
    AND tenant_id = _tenant_id;

  SELECT COALESCE(SUM(target_amount), 0) INTO _goal
  FROM public.operator_goals
  WHERE tenant_id = _tenant_id
    AND operator_id = _operator_profile_id
    AND year = _year
    AND month = _month;

  _goal_reached := (_goal > 0 AND _total_received >= _goal);

  _sum := 0;
  FOR _r IN
    SELECT metric, points, unit_size
    FROM public.gamification_scoring_rules
    WHERE tenant_id = _tenant_id AND enabled = true
  LOOP
    _metric_value := CASE _r.metric
      WHEN 'payment_count'        THEN _payments_count
      WHEN 'total_received'       THEN _total_received
      WHEN 'agreement_created'    THEN _agreements_count
      WHEN 'agreement_paid'       THEN _agreements_paid_count
      WHEN 'agreement_break'      THEN _breaks_count
      WHEN 'achievement_unlocked' THEN _achievements_count
      WHEN 'goal_reached'         THEN CASE WHEN _goal_reached THEN 1 ELSE 0 END
      ELSE 0
    END;

    IF _r.metric = 'goal_reached' THEN
      _sum := _sum + (_metric_value * _r.points);
    ELSE
      _sum := _sum + (FLOOR(_metric_value / NULLIF(_r.unit_size, 0))::numeric * _r.points);
    END IF;
  END LOOP;

  _points := GREATEST(0, _sum)::int;

  INSERT INTO public.operator_points (
    tenant_id, operator_id, year, month,
    points, payments_count, breaks_count, total_received, updated_at
  ) VALUES (
    _tenant_id, _operator_profile_id, _year, _month,
    _points, _payments_count, _breaks_count, _total_received, now()
  )
  ON CONFLICT (tenant_id, operator_id, year, month) DO UPDATE
  SET points = EXCLUDED.points,
      payments_count = EXCLUDED.payments_count,
      breaks_count = EXCLUDED.breaks_count,
      total_received = EXCLUDED.total_received,
      updated_at = now();

  RETURN jsonb_build_object(
    'tenant_id', _tenant_id,
    'operator_id', _operator_profile_id,
    'year', _year,
    'month', _month,
    'payments_count', _payments_count,
    'total_received', _total_received,
    'agreements_count', _agreements_count,
    'agreements_paid_count', _agreements_paid_count,
    'breaks_count', _breaks_count,
    'achievements_count', _achievements_count,
    'goal', _goal,
    'goal_reached', _goal_reached,
    'points', _points
  );
END;
$$;
