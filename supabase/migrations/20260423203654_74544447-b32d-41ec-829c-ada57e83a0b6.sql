-- Gamification snapshot recalculation RPCs (SECURITY DEFINER)
-- These functions safely recalculate operator_points for the current user or any operator (admin only),
-- using clients.valor_pago + agreements as source of truth.

CREATE OR REPLACE FUNCTION public.recalculate_operator_gamification_snapshot(
  _operator_profile_id uuid,
  _year int,
  _month int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _operator_user_id uuid;
  _month_start date;
  _next_month date;
  _payments_count int := 0;
  _total_received numeric := 0;
  _agreements_count int := 0;
  _breaks_count int := 0;
  _achievements_count int := 0;
  _goal numeric := 0;
  _goal_reached boolean := false;
  _points int := 0;
BEGIN
  -- Resolve tenant + auth.user_id of the target operator
  SELECT p.tenant_id, p.user_id
  INTO _tenant_id, _operator_user_id
  FROM public.profiles p
  WHERE p.id = _operator_profile_id
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  -- Authorization: caller must be the same operator OR a tenant admin
  IF NOT (
    _operator_user_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), _tenant_id)
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  _month_start := make_date(_year, _month, 1);
  _next_month := (_month_start + interval '1 month')::date;

  -- Payments count + total received from clients (operator carteira, quitados no mês)
  SELECT COUNT(*), COALESCE(SUM(valor_pago), 0)
  INTO _payments_count, _total_received
  FROM public.clients
  WHERE tenant_id = _tenant_id
    AND operator_id = _operator_profile_id
    AND data_quitacao IS NOT NULL
    AND data_quitacao >= _month_start
    AND data_quitacao < _next_month;

  -- Agreements count this month (não cancelados/rejeitados)
  IF _operator_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _agreements_count
    FROM public.agreements
    WHERE tenant_id = _tenant_id
      AND created_by = _operator_user_id
      AND status NOT IN ('cancelled', 'rejected')
      AND created_at >= _month_start
      AND created_at < _next_month;

    SELECT COUNT(*) INTO _breaks_count
    FROM public.agreements
    WHERE tenant_id = _tenant_id
      AND created_by = _operator_user_id
      AND status = 'cancelled'
      AND updated_at >= _month_start
      AND updated_at < _next_month;
  END IF;

  -- Achievements
  SELECT COUNT(*) INTO _achievements_count
  FROM public.achievements
  WHERE profile_id = _operator_profile_id
    AND tenant_id = _tenant_id;

  -- Goal
  SELECT COALESCE(SUM(target_amount), 0) INTO _goal
  FROM public.operator_goals
  WHERE tenant_id = _tenant_id
    AND operator_id = _operator_profile_id
    AND year = _year
    AND month = _month;

  _goal_reached := (_goal > 0 AND _total_received >= _goal);

  -- Points formula (mirrors calculatePoints in gamificationService.ts)
  _points := GREATEST(
    0,
    (_payments_count * 10)
    + (FLOOR(_total_received / 100)::int * 5)
    - (_breaks_count * 3)
    + (_achievements_count * 50)
    + (CASE WHEN _goal_reached THEN 100 ELSE 0 END)
  );

  -- Upsert snapshot
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
    'breaks_count', _breaks_count,
    'achievements_count', _achievements_count,
    'goal', _goal,
    'goal_reached', _goal_reached,
    'points', _points
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_operator_gamification_snapshot(uuid, int, int) TO authenticated;

-- Convenience: recalculate snapshot for the current authenticated user
CREATE OR REPLACE FUNCTION public.recalculate_my_gamification_snapshot(
  _year int,
  _month int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_id uuid;
BEGIN
  SELECT id INTO _profile_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF _profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;
  RETURN public.recalculate_operator_gamification_snapshot(_profile_id, _year, _month);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_my_gamification_snapshot(int, int) TO authenticated;

-- Tenant-wide recalculation (admin only) - iterates over enabled participants (or all operators)
CREATE OR REPLACE FUNCTION public.recalculate_tenant_gamification_snapshot(
  _year int,
  _month int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _profile_id uuid;
  _count int := 0;
BEGIN
  SELECT tenant_id INTO _tenant_id FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  IF NOT public.is_tenant_admin(auth.uid(), _tenant_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Iterate over enabled participants; fallback to all profiles if none configured
  IF EXISTS (SELECT 1 FROM public.gamification_participants WHERE tenant_id = _tenant_id AND enabled = true) THEN
    FOR _profile_id IN
      SELECT profile_id FROM public.gamification_participants
      WHERE tenant_id = _tenant_id AND enabled = true
    LOOP
      PERFORM public.recalculate_operator_gamification_snapshot(_profile_id, _year, _month);
      _count := _count + 1;
    END LOOP;
  ELSE
    FOR _profile_id IN
      SELECT id FROM public.profiles WHERE tenant_id = _tenant_id
    LOOP
      PERFORM public.recalculate_operator_gamification_snapshot(_profile_id, _year, _month);
      _count := _count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('tenant_id', _tenant_id, 'year', _year, 'month', _month, 'recalculated', _count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_tenant_gamification_snapshot(int, int) TO authenticated;