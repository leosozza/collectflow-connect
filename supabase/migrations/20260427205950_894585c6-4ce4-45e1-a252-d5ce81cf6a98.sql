CREATE OR REPLACE FUNCTION public.recalculate_operator_gamification_snapshot(_operator_profile_id uuid, _year integer, _month integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _operator_user_id uuid;
  _month_start date;
  _next_month date;
  _payments_count int := 0;
  _total_received numeric := 0;
  _manual_count int := 0;
  _manual_total numeric := 0;
  _neg_count int := 0;
  _neg_total numeric := 0;
  _agreements_count int := 0;
  _agreements_paid_count int := 0;
  _breaks_count int := 0;
  _achievements_count int := 0;
  _goal numeric := 0;
  _goal_reached boolean := false;
  _points int := 0;

  _w_payment        int := 0;
  _u_total_received int := 100;
  _w_total_received int := 0;
  _w_agreement_created int := 0;
  _w_agreement_paid    int := 0;
  _w_agreement_break   int := 0;
  _w_achievement       int := 0;
  _w_goal              int := 0;
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

  SELECT COALESCE(MAX(CASE WHEN metric = 'payment_count'        AND enabled THEN points END), 0),
         COALESCE(MAX(CASE WHEN metric = 'total_received'       AND enabled THEN unit_size END), 100),
         COALESCE(MAX(CASE WHEN metric = 'total_received'       AND enabled THEN points END), 0),
         COALESCE(MAX(CASE WHEN metric = 'agreement_created'    AND enabled THEN points END), 0),
         COALESCE(MAX(CASE WHEN metric = 'agreement_paid'       AND enabled THEN points END), 0),
         COALESCE(MAX(CASE WHEN metric = 'agreement_break'      AND enabled THEN points END), 0),
         COALESCE(MAX(CASE WHEN metric = 'achievement_unlocked' AND enabled THEN points END), 0),
         COALESCE(MAX(CASE WHEN metric = 'goal_reached'         AND enabled THEN points END), 0)
  INTO _w_payment, _u_total_received, _w_total_received,
       _w_agreement_created, _w_agreement_paid, _w_agreement_break,
       _w_achievement, _w_goal
  FROM public.gamification_scoring_rules
  WHERE tenant_id = _tenant_id;

  IF _u_total_received IS NULL OR _u_total_received <= 0 THEN
    _u_total_received := 100;
  END IF;

  -- ============= FONTE CANÔNICA DE PAGAMENTO REAL =============
  -- Mesma lógica usada por get_agreement_financials (Relatórios/Analytics)
  -- Atribuição: agreements.created_by = operador
  IF _operator_user_id IS NOT NULL THEN
    -- Canal 1: parcelas confirmadas manualmente
    SELECT COUNT(*), COALESCE(SUM(mp.amount_paid), 0)
    INTO _manual_count, _manual_total
    FROM public.manual_payments mp
    JOIN public.agreements a ON a.id = mp.agreement_id
    WHERE mp.tenant_id = _tenant_id
      AND mp.status = 'confirmed'
      AND a.created_by = _operator_user_id
      AND mp.payment_date >= _month_start
      AND mp.payment_date < _next_month;

    -- Canal 2: pagamentos via gateway Negociarie
    SELECT COUNT(*), COALESCE(SUM(nc.valor_pago), 0)
    INTO _neg_count, _neg_total
    FROM public.negociarie_cobrancas nc
    JOIN public.agreements a ON a.id = nc.agreement_id
    WHERE a.tenant_id = _tenant_id
      AND nc.status = 'pago'
      AND a.created_by = _operator_user_id
      AND nc.data_pagamento >= _month_start
      AND nc.data_pagamento < _next_month;
  END IF;

  _payments_count := _manual_count + _neg_count;
  _total_received := _manual_total + _neg_total;
  -- ============================================================

  IF _operator_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _agreements_count
    FROM public.agreements
    WHERE tenant_id = _tenant_id
      AND created_by = _operator_user_id
      AND status NOT IN ('cancelled', 'rejected')
      AND created_at >= _month_start
      AND created_at < _next_month;

    SELECT COUNT(*) INTO _agreements_paid_count
    FROM public.agreements
    WHERE tenant_id = _tenant_id
      AND created_by = _operator_user_id
      AND status = 'completed'
      AND updated_at >= _month_start
      AND updated_at < _next_month;

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

  _points := GREATEST(
    0,
    (_payments_count        * _w_payment)
    + (FLOOR(_total_received / _u_total_received)::int * _w_total_received)
    + (_agreements_count     * _w_agreement_created)
    + (_agreements_paid_count * _w_agreement_paid)
    + (_breaks_count         * _w_agreement_break)
    + (_achievements_count   * _w_achievement)
    + (CASE WHEN _goal_reached THEN _w_goal ELSE 0 END)
  );

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
    'manual_count', _manual_count,
    'manual_total', _manual_total,
    'negociarie_count', _neg_count,
    'negociarie_total', _neg_total,
    'total_received', _total_received,
    'agreements_count', _agreements_count,
    'agreements_paid_count', _agreements_paid_count,
    'breaks_count', _breaks_count,
    'achievements_count', _achievements_count,
    'goal', _goal,
    'goal_reached', _goal_reached,
    'points', _points,
    'weights', jsonb_build_object(
      'payment_count', _w_payment,
      'total_received_unit', _u_total_received,
      'total_received', _w_total_received,
      'agreement_created', _w_agreement_created,
      'agreement_paid', _w_agreement_paid,
      'agreement_break', _w_agreement_break,
      'achievement_unlocked', _w_achievement,
      'goal_reached', _w_goal
    )
  );
END;
$function$;