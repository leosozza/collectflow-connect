
-- ============================================================
-- 1. CHECK CONSTRAINTS em scoring rules (proteção contra valores absurdos)
-- ============================================================
ALTER TABLE public.gamification_scoring_rules
  DROP CONSTRAINT IF EXISTS scoring_rules_unit_size_positive;
ALTER TABLE public.gamification_scoring_rules
  ADD CONSTRAINT scoring_rules_unit_size_positive CHECK (unit_size >= 1);

ALTER TABLE public.gamification_scoring_rules
  DROP CONSTRAINT IF EXISTS scoring_rules_points_range;
ALTER TABLE public.gamification_scoring_rules
  ADD CONSTRAINT scoring_rules_points_range CHECK (points BETWEEN -1000 AND 1000);

-- ============================================================
-- 2. SEED: achievement templates padrão por tenant
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_default_achievement_templates(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.achievement_templates
    (tenant_id, title, description, icon, criteria_type, criteria_value, points_reward, is_active)
  VALUES
    (_tenant_id, 'Primeiro Pagamento',  'Confirmou o primeiro pagamento do mês.',          '🥇',  'payments_count',   1,     20,  true),
    (_tenant_id, '10 Pagamentos',       'Confirmou 10 pagamentos no mês.',                  '💪',  'payments_count',   10,    100, true),
    (_tenant_id, '50 Pagamentos',       'Confirmou 50 pagamentos no mês.',                  '🚀',  'payments_count',   50,    300, true),
    (_tenant_id, 'R$ 10.000 recebidos', 'Recebeu R$ 10 mil no mês.',                        '💰',  'total_received',   10000, 150, true),
    (_tenant_id, 'R$ 50.000 recebidos', 'Recebeu R$ 50 mil no mês.',                        '🏆',  'total_received',   50000, 500, true),
    (_tenant_id, 'Meta do Mês',         'Bateu a meta mensal de recebimento.',              '🎯',  'goal_reached',     0,     200, true),
    (_tenant_id, 'Sem Quebras',         'Fechou o mês com zero quebras de acordo.',         '🛡️',  'zero_breaks',      0,     150, true),
    (_tenant_id, '5 Acordos',           'Formalizou 5 acordos no mês.',                     '🤝',  'agreements_count', 5,     50,  true)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================
-- 3. TRIGGER: ao criar tenant, semear regras + templates
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_gamification_defaults_on_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Regras de pontuação (já existia a função, faltava o trigger)
  INSERT INTO public.gamification_scoring_rules (tenant_id, metric, label, points, unit_size, enabled)
  VALUES
    (NEW.id, 'payment_count',        'Pagamento confirmado',       10,  1,   true),
    (NEW.id, 'total_received',       'Cada R$ 100 recebidos',       5,  100, true),
    (NEW.id, 'agreement_created',    'Acordo formalizado',          0,  1,   true),
    (NEW.id, 'agreement_paid',       'Acordo totalmente quitado',  30,  1,   true),
    (NEW.id, 'agreement_break',      'Quebra de acordo',           -3,  1,   true),
    (NEW.id, 'achievement_unlocked', 'Conquista desbloqueada',     50,  1,   true),
    (NEW.id, 'goal_reached',         'Meta do mês atingida',      100,  1,   true)
  ON CONFLICT (tenant_id, metric) DO NOTHING;

  -- Conquistas padrão
  PERFORM public.seed_default_achievement_templates(NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_gamification_defaults ON public.tenants;
CREATE TRIGGER trg_seed_gamification_defaults
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.seed_gamification_defaults_on_tenant();

-- ============================================================
-- 4. BACKFILL: tenants existentes sem regras/templates
-- ============================================================
INSERT INTO public.gamification_scoring_rules (tenant_id, metric, label, points, unit_size, enabled)
SELECT t.id, x.metric, x.label, x.points, x.unit_size, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('payment_count'::text,        'Pagamento confirmado',       10,  1),
  ('total_received',              'Cada R$ 100 recebidos',       5,  100),
  ('agreement_created',           'Acordo formalizado',          0,  1),
  ('agreement_paid',              'Acordo totalmente quitado',  30,  1),
  ('agreement_break',             'Quebra de acordo',           -3,  1),
  ('achievement_unlocked',        'Conquista desbloqueada',     50,  1),
  ('goal_reached',                'Meta do mês atingida',      100,  1)
) AS x(metric, label, points, unit_size)
ON CONFLICT (tenant_id, metric) DO NOTHING;

-- Backfill achievement templates (usa função para idempotência)
DO $$
DECLARE
  t_id uuid;
BEGIN
  FOR t_id IN
    SELECT id FROM public.tenants
    WHERE NOT EXISTS (
      SELECT 1 FROM public.achievement_templates a WHERE a.tenant_id = tenants.id
    )
  LOOP
    PERFORM public.seed_default_achievement_templates(t_id);
  END LOOP;
END $$;

-- ============================================================
-- 5. SSoT: snapshot agora usa get_operator_received_total (manual + portal + negociarie)
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_operator_gamification_snapshot(
  _operator_profile_id uuid, _year integer, _month integer
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
  _end_inclusive date;
  _payments_count int := 0;
  _total_received numeric := 0;
  _manual_count int := 0;
  _manual_total numeric := 0;
  _portal_count int := 0;
  _portal_total numeric := 0;
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
  _end_inclusive := _next_month - 1;

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

  IF _operator_user_id IS NOT NULL THEN
    -- Canal 1: parcelas manuais confirmadas
    SELECT COUNT(*), COALESCE(SUM(mp.amount_paid), 0)
    INTO _manual_count, _manual_total
    FROM public.manual_payments mp
    JOIN public.agreements a ON a.id = mp.agreement_id
    WHERE mp.tenant_id = _tenant_id
      AND mp.status IN ('confirmed','approved')
      AND a.created_by = _operator_user_id
      AND mp.payment_date >= _month_start
      AND mp.payment_date < _next_month;

    -- Canal 2: portal payments (Portal do Devedor)
    SELECT COUNT(*), COALESCE(SUM(pp.amount), 0)
    INTO _portal_count, _portal_total
    FROM public.portal_payments pp
    JOIN public.agreements a ON a.id = pp.agreement_id
    WHERE pp.tenant_id = _tenant_id
      AND pp.status = 'paid'
      AND a.created_by = _operator_user_id
      AND pp.updated_at >= _month_start::timestamptz
      AND pp.updated_at < _next_month::timestamptz;

    -- Canal 3: Negociarie
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

  _payments_count := _manual_count + _portal_count + _neg_count;
  _total_received := _manual_total + _portal_total + _neg_total;

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
    (_payments_count          * _w_payment)
    + (FLOOR(_total_received / _u_total_received)::int * _w_total_received)
    + (_agreements_count       * _w_agreement_created)
    + (_agreements_paid_count  * _w_agreement_paid)
    + (_breaks_count           * _w_agreement_break)
    + (_achievements_count     * _w_achievement)
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
    'year', _year, 'month', _month,
    'payments_count', _payments_count,
    'manual_count', _manual_count, 'manual_total', _manual_total,
    'portal_count', _portal_count, 'portal_total', _portal_total,
    'negociarie_count', _neg_count, 'negociarie_total', _neg_total,
    'total_received', _total_received,
    'agreements_count', _agreements_count,
    'agreements_paid_count', _agreements_paid_count,
    'breaks_count', _breaks_count,
    'achievements_count', _achievements_count,
    'goal', _goal, 'goal_reached', _goal_reached,
    'points', _points
  );
END;
$$;

-- ============================================================
-- 6. RPC server-side: negociado_e_recebido (campanha) usando SSoT
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_operator_negotiated_and_received(
  _operator_user_id uuid,
  _start_date date,
  _end_date date,
  _credor_names text[] DEFAULT NULL
) RETURNS numeric
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
  IF _tenant IS NULL THEN RETURN 0; END IF;

  -- Pagamentos (qualquer canal) atribuídos a acordos criados pelo operador na janela
  WITH ags AS (
    SELECT id, client_cpf, credor
    FROM public.agreements
    WHERE tenant_id = _tenant
      AND created_by = _operator_user_id
      AND status NOT IN ('rejected','cancelled')
      AND created_at >= _start_date::timestamptz
      AND created_at <  (_end_date + 1)::timestamptz
      AND (_credor_names IS NULL OR credor = ANY(_credor_names))
  )
  SELECT
      COALESCE((SELECT SUM(mp.amount_paid)
        FROM public.manual_payments mp JOIN ags ON ags.id = mp.agreement_id
        WHERE mp.tenant_id = _tenant
          AND mp.status IN ('confirmed','approved')
          AND mp.payment_date BETWEEN _start_date AND _end_date), 0)
    + COALESCE((SELECT SUM(pp.amount)
        FROM public.portal_payments pp JOIN ags ON ags.id = pp.agreement_id
        WHERE pp.tenant_id = _tenant AND pp.status = 'paid'
          AND pp.updated_at >= _start_date::timestamptz
          AND pp.updated_at <  (_end_date + 1)::timestamptz), 0)
    + COALESCE((SELECT SUM(nc.valor_pago)
        FROM public.negociarie_cobrancas nc JOIN ags ON ags.id = nc.agreement_id
        WHERE nc.tenant_id = _tenant AND nc.status = 'pago'
          AND nc.data_pagamento BETWEEN _start_date AND _end_date), 0)
  INTO _total;

  RETURN _total;
END;
$$;

-- ============================================================
-- 7. close_campaign_and_award_points: só premia score > 0
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_campaign_and_award_points(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_camp record;
  v_year int;
  v_month int;
  v_winners jsonb := '[]'::jsonb;
  r record;
  v_pts int;
  v_pos int := 0;
BEGIN
  SELECT * INTO v_camp FROM public.gamification_campaigns WHERE id = _campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;
  IF v_camp.status = 'completed' THEN RAISE EXCEPTION 'Campanha já encerrada'; END IF;

  v_year := EXTRACT(YEAR FROM COALESCE(v_camp.end_date, CURRENT_DATE))::int;
  v_month := EXTRACT(MONTH FROM COALESCE(v_camp.end_date, CURRENT_DATE))::int;

  FOR r IN
    SELECT operator_id, score
    FROM public.campaign_participants
    WHERE campaign_id = _campaign_id
      AND tenant_id = v_camp.tenant_id
      AND COALESCE(score, 0) > 0
    ORDER BY score DESC NULLS LAST
    LIMIT 3
  LOOP
    v_pos := v_pos + 1;
    v_pts := CASE v_pos
              WHEN 1 THEN COALESCE(v_camp.points_first, 0)
              WHEN 2 THEN COALESCE(v_camp.points_second, 0)
              WHEN 3 THEN COALESCE(v_camp.points_third, 0)
             END;
    IF v_pts > 0 THEN
      PERFORM public.add_operator_bonus_points(v_camp.tenant_id, r.operator_id, v_year, v_month, v_pts);
    END IF;
    v_winners := v_winners || jsonb_build_object('position', v_pos, 'operator_id', r.operator_id, 'score', r.score, 'points', v_pts);
  END LOOP;

  UPDATE public.gamification_campaigns SET status = 'completed', updated_at = now() WHERE id = _campaign_id;

  RETURN jsonb_build_object('campaign_id', _campaign_id, 'winners', v_winners);
END;
$$;

-- ============================================================
-- 8. convert_monthly_points_to_rivocoins: filtra tenants ativos com módulo gamificacao
-- ============================================================
CREATE OR REPLACE FUNCTION public.convert_monthly_points_to_rivocoins(_year integer, _month integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_total int;
  v_processed int := 0;
  v_credited int := 0;
BEGIN
  FOR r IN
    SELECT op.id, op.tenant_id, op.operator_id, (op.points + COALESCE(op.bonus_points,0)) AS total
    FROM public.operator_points op
    JOIN public.tenants t ON t.id = op.tenant_id AND t.status = 'active'
    WHERE op.year = _year AND op.month = _month AND op.converted_to_coins = false
      AND EXISTS (
        SELECT 1 FROM public.tenant_modules tm
        JOIN public.system_modules sm ON sm.id = tm.module_id
        WHERE tm.tenant_id = op.tenant_id AND tm.enabled = true AND sm.slug = 'gamificacao'
      )
  LOOP
    v_processed := v_processed + 1;
    v_total := COALESCE(r.total, 0);

    IF v_total > 0 THEN
      INSERT INTO public.rivocoin_transactions
        (tenant_id, profile_id, amount, type, description, reference_type, reference_id)
      VALUES
        (r.tenant_id, r.operator_id, v_total, 'earn',
         format('Conversão mensal %s/%s', _month, _year),
         'monthly_conversion', r.id);

      INSERT INTO public.rivocoin_wallets (tenant_id, profile_id, balance, total_earned, total_spent)
      VALUES (r.tenant_id, r.operator_id, v_total, v_total, 0)
      ON CONFLICT (tenant_id, profile_id)
      DO UPDATE SET balance = public.rivocoin_wallets.balance + v_total,
                    total_earned = public.rivocoin_wallets.total_earned + v_total,
                    updated_at = now();

      v_credited := v_credited + v_total;
    END IF;

    UPDATE public.operator_points
    SET converted_to_coins = true, converted_at = now()
    WHERE id = r.id;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'credited', v_credited, 'year', _year, 'month', _month);
END;
$$;

-- ============================================================
-- 9. Recalcular Abril/2026 com a nova lógica unificada
-- ============================================================
DO $$
DECLARE
  t_id uuid;
  p_id uuid;
BEGIN
  FOR t_id IN SELECT id FROM public.tenants WHERE status='active'
  LOOP
    FOR p_id IN
      SELECT id FROM public.profiles WHERE tenant_id = t_id
    LOOP
      PERFORM public.recalculate_operator_gamification_snapshot(p_id, 2026, 4);
    END LOOP;
  END LOOP;
END $$;
