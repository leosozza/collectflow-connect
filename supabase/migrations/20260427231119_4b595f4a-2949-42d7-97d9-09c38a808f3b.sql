
-- ============================================================
-- recalculate_operator_full: 1 RPC consolidada (snapshot + campanhas + meta + conquistas)
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_operator_full(
  _profile_id uuid,
  _year integer,
  _month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _auth_uid uuid;
  _start_date date;
  _end_date date;
  _snapshot_payments_count integer := 0;
  _snapshot_total_received numeric := 0;
  _snapshot_breaks_count integer := 0;
  _snapshot_points integer := 0;
  _agreements_count integer := 0;
  _campaigns_updated integer := 0;
  _goal_awarded boolean := false;
  _achievements_granted integer := 0;
  _campaign record;
  _credor_names text[];
  _score numeric;
  _goal record;
  _tpl record;
  _already_has boolean;
BEGIN
  -- Resolve tenant and auth.uid for the profile
  SELECT tenant_id, user_id INTO _tenant_id, _auth_uid
  FROM profiles
  WHERE id = _profile_id;

  IF _tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  IF _auth_uid IS NULL THEN
    _auth_uid := _profile_id;
  END IF;

  _start_date := make_date(_year, _month, 1);
  _end_date := (_start_date + INTERVAL '1 month' - INTERVAL '1 day')::date;

  -- 1) Snapshot mensal (fonte do ranking) - já é SSoT consolidada
  PERFORM public.recalculate_operator_gamification_snapshot(_profile_id, _year, _month);

  SELECT payments_count, total_received, breaks_count, points
    INTO _snapshot_payments_count, _snapshot_total_received, _snapshot_breaks_count, _snapshot_points
  FROM operator_points
  WHERE tenant_id = _tenant_id
    AND operator_id = _profile_id
    AND year = _year
    AND month = _month;

  _snapshot_payments_count := COALESCE(_snapshot_payments_count, 0);
  _snapshot_total_received := COALESCE(_snapshot_total_received, 0);
  _snapshot_breaks_count := COALESCE(_snapshot_breaks_count, 0);

  -- Contagem de acordos no mês (para conquistas)
  SELECT COUNT(*) INTO _agreements_count
  FROM agreements
  WHERE tenant_id = _tenant_id
    AND created_by = _auth_uid
    AND status NOT IN ('rejected','cancelled')
    AND created_at >= _start_date
    AND created_at < (_end_date + INTERVAL '1 day');

  -- 2) Campanhas ativas em que o operador participa
  FOR _campaign IN
    SELECT c.id, c.metric, c.start_date, c.end_date
    FROM gamification_campaigns c
    INNER JOIN campaign_participants cp ON cp.campaign_id = c.id
    WHERE c.tenant_id = _tenant_id
      AND cp.operator_id = _profile_id
      AND c.status = 'ativa'
      AND c.start_date IS NOT NULL
      AND c.end_date IS NOT NULL
  LOOP
    -- Resolve credores da campanha
    SELECT array_agg(cr.razao_social) INTO _credor_names
    FROM campaign_credores cc
    INNER JOIN credores cr ON cr.id = cc.credor_id
    WHERE cc.campaign_id = _campaign.id
      AND cc.tenant_id = _tenant_id;

    _score := 0;

    IF _campaign.metric = 'maior_valor_recebido' THEN
      _score := COALESCE(public.get_operator_received_total(
        _auth_uid, _campaign.start_date, _campaign.end_date, _credor_names
      ), 0);

    ELSIF _campaign.metric = 'negociado_e_recebido' THEN
      _score := COALESCE(public.get_operator_negotiated_and_received(
        _auth_uid, _campaign.start_date, _campaign.end_date, _credor_names
      ), 0);

    ELSIF _campaign.metric = 'maior_qtd_acordos' THEN
      SELECT COUNT(*) INTO _score
      FROM agreements
      WHERE tenant_id = _tenant_id
        AND created_by = _auth_uid
        AND status NOT IN ('rejected','cancelled')
        AND created_at >= _campaign.start_date
        AND created_at < (_campaign.end_date + INTERVAL '1 day')
        AND (_credor_names IS NULL OR credor = ANY(_credor_names));

    ELSIF _campaign.metric = 'menor_taxa_quebra' THEN
      DECLARE
        _total integer; _breaks integer;
      BEGIN
        SELECT COUNT(*) INTO _total
        FROM agreements
        WHERE tenant_id = _tenant_id
          AND created_by = _auth_uid
          AND created_at >= _campaign.start_date
          AND created_at < (_campaign.end_date + INTERVAL '1 day')
          AND (_credor_names IS NULL OR credor = ANY(_credor_names));

        IF COALESCE(_total,0) = 0 THEN
          _score := 100;
        ELSE
          SELECT COUNT(*) INTO _breaks
          FROM agreements
          WHERE tenant_id = _tenant_id
            AND created_by = _auth_uid
            AND status = 'cancelled'
            AND updated_at >= _campaign.start_date
            AND updated_at < (_campaign.end_date + INTERVAL '1 day')
            AND (_credor_names IS NULL OR credor = ANY(_credor_names));
          _score := GREATEST(0, 100 - (COALESCE(_breaks,0)::numeric / _total::numeric) * 100);
        END IF;
      END;

    ELSIF _campaign.metric = 'menor_valor_quebra' THEN
      SELECT GREATEST(0, 1000000 - COALESCE(SUM(proposed_total),0)) INTO _score
      FROM agreements
      WHERE tenant_id = _tenant_id
        AND created_by = _auth_uid
        AND status = 'cancelled'
        AND updated_at >= _campaign.start_date
        AND updated_at < (_campaign.end_date + INTERVAL '1 day')
        AND (_credor_names IS NULL OR credor = ANY(_credor_names));

    ELSIF _campaign.metric = 'maior_valor_promessas' THEN
      SELECT COALESCE(SUM(proposed_total),0) INTO _score
      FROM agreements
      WHERE tenant_id = _tenant_id
        AND created_by = _auth_uid
        AND status IN ('pending','approved')
        AND created_at >= _campaign.start_date
        AND created_at < (_campaign.end_date + INTERVAL '1 day')
        AND (_credor_names IS NULL OR credor = ANY(_credor_names));

    ELSE
      -- default: usa SSoT unificada
      _score := COALESCE(public.get_operator_received_total(
        _auth_uid, _campaign.start_date, _campaign.end_date, _credor_names
      ), 0);
    END IF;

    UPDATE campaign_participants
    SET score = _score, updated_at = now()
    WHERE campaign_id = _campaign.id
      AND operator_id = _profile_id;

    _campaigns_updated := _campaigns_updated + 1;
  END LOOP;

  -- 3) Meta mensal: premia se batida
  SELECT id, target_amount, points_reward, points_awarded INTO _goal
  FROM operator_goals
  WHERE tenant_id = _tenant_id
    AND operator_id = _profile_id
    AND year = _year
    AND month = _month
    AND credor_id IS NULL
  LIMIT 1;

  IF _goal.id IS NOT NULL
     AND COALESCE(_goal.points_awarded, false) = false
     AND COALESCE(_goal.points_reward, 0) > 0
     AND _snapshot_total_received >= COALESCE(_goal.target_amount, 0)
  THEN
    PERFORM public.add_operator_bonus_points(
      _tenant_id, _profile_id, _year, _month, _goal.points_reward
    );
    UPDATE operator_goals SET points_awarded = true WHERE id = _goal.id;
    _goal_awarded := true;
  END IF;

  -- 4) Conquistas baseadas em achievement_templates
  FOR _tpl IN
    SELECT id, title, description, icon, criteria_type, criteria_value, points_reward
    FROM achievement_templates
    WHERE tenant_id = _tenant_id
      AND is_active = true
      AND credor_id IS NULL
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM achievements
      WHERE tenant_id = _tenant_id
        AND profile_id = _profile_id
        AND title = _tpl.title
    ) INTO _already_has;

    IF _already_has THEN CONTINUE; END IF;

    DECLARE _matched boolean := false;
    BEGIN
      IF _tpl.criteria_type = 'payments_count' AND _snapshot_payments_count >= _tpl.criteria_value THEN
        _matched := true;
      ELSIF _tpl.criteria_type = 'total_received' AND _snapshot_total_received >= _tpl.criteria_value THEN
        _matched := true;
      ELSIF _tpl.criteria_type = 'agreements_count' AND _agreements_count >= _tpl.criteria_value THEN
        _matched := true;
      ELSIF _tpl.criteria_type = 'no_breaks' AND _snapshot_breaks_count = 0 AND _snapshot_payments_count >= _tpl.criteria_value THEN
        _matched := true;
      ELSIF _tpl.criteria_type = 'goal_reached' AND _goal_awarded THEN
        _matched := true;
      END IF;

      IF _matched THEN
        INSERT INTO achievements (tenant_id, profile_id, title, description, icon)
        VALUES (_tenant_id, _profile_id, _tpl.title, _tpl.description, _tpl.icon);

        IF COALESCE(_tpl.points_reward, 0) > 0 THEN
          PERFORM public.add_operator_bonus_points(
            _tenant_id, _profile_id, _year, _month, _tpl.points_reward
          );
        END IF;

        _achievements_granted := _achievements_granted + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_id', _tenant_id,
    'profile_id', _profile_id,
    'year', _year,
    'month', _month,
    'snapshot', jsonb_build_object(
      'points', _snapshot_points,
      'payments_count', _snapshot_payments_count,
      'total_received', _snapshot_total_received,
      'breaks_count', _snapshot_breaks_count,
      'agreements_count', _agreements_count
    ),
    'campaigns_updated', _campaigns_updated,
    'goal_awarded', _goal_awarded,
    'achievements_granted', _achievements_granted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_operator_full(uuid, integer, integer) TO authenticated, service_role;

-- ============================================================
-- recalculate_my_full: wrapper para o usuário autenticado
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_my_full(
  _year integer,
  _month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_id uuid;
BEGIN
  SELECT id INTO _profile_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  IF _profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;
  RETURN public.recalculate_operator_full(_profile_id, _year, _month);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_my_full(integer, integer) TO authenticated;
