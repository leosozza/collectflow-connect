-- 1) Tabela de regras de pontuação por tenant
CREATE TABLE IF NOT EXISTS public.gamification_scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric text NOT NULL,
  label text NOT NULL,
  points numeric NOT NULL DEFAULT 0,
  unit_size numeric NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gamification_scoring_rules_metric_check CHECK (
    metric IN (
      'payment_count',
      'total_received',
      'agreement_created',
      'agreement_paid',
      'agreement_break',
      'achievement_unlocked',
      'goal_reached'
    )
  ),
  CONSTRAINT gamification_scoring_rules_unit_size_check CHECK (unit_size > 0),
  CONSTRAINT gamification_scoring_rules_unique UNIQUE (tenant_id, metric)
);

CREATE INDEX IF NOT EXISTS idx_gam_scoring_rules_tenant ON public.gamification_scoring_rules(tenant_id);

ALTER TABLE public.gamification_scoring_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scoring_rules_select" ON public.gamification_scoring_rules;
CREATE POLICY "scoring_rules_select" ON public.gamification_scoring_rules
FOR SELECT TO authenticated
USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "scoring_rules_insert" ON public.gamification_scoring_rules;
CREATE POLICY "scoring_rules_insert" ON public.gamification_scoring_rules
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_my_tenant_id()
  AND public.is_tenant_admin(auth.uid(), tenant_id)
);

DROP POLICY IF EXISTS "scoring_rules_update" ON public.gamification_scoring_rules;
CREATE POLICY "scoring_rules_update" ON public.gamification_scoring_rules
FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_my_tenant_id()
  AND public.is_tenant_admin(auth.uid(), tenant_id)
)
WITH CHECK (
  tenant_id = public.get_my_tenant_id()
  AND public.is_tenant_admin(auth.uid(), tenant_id)
);

DROP POLICY IF EXISTS "scoring_rules_delete" ON public.gamification_scoring_rules;
CREATE POLICY "scoring_rules_delete" ON public.gamification_scoring_rules
FOR DELETE TO authenticated
USING (
  tenant_id = public.get_my_tenant_id()
  AND public.is_tenant_admin(auth.uid(), tenant_id)
);

DROP TRIGGER IF EXISTS update_scoring_rules_updated_at ON public.gamification_scoring_rules;
CREATE TRIGGER update_scoring_rules_updated_at
BEFORE UPDATE ON public.gamification_scoring_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Seed das 7 regras default para todos os tenants existentes
INSERT INTO public.gamification_scoring_rules (tenant_id, metric, label, points, unit_size, enabled)
SELECT t.id, v.metric, v.label, v.points, v.unit_size, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('payment_count',        'Pagamento confirmado',       10,  1),
  ('total_received',       'Cada R$ 100 recebidos',       5,  100),
  ('agreement_created',    'Acordo formalizado',          0,  1),
  ('agreement_paid',       'Acordo totalmente quitado',  30,  1),
  ('agreement_break',      'Quebra de acordo',           -3,  1),
  ('achievement_unlocked', 'Conquista desbloqueada',     50,  1),
  ('goal_reached',         'Meta do mês atingida',      100,  1)
) AS v(metric, label, points, unit_size)
ON CONFLICT (tenant_id, metric) DO NOTHING;

-- 3) Trigger: novo tenant ganha as 7 regras default automaticamente
CREATE OR REPLACE FUNCTION public.seed_default_scoring_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.gamification_scoring_rules (tenant_id, metric, label, points, unit_size, enabled)
  VALUES
    (NEW.id, 'payment_count',        'Pagamento confirmado',       10,  1, true),
    (NEW.id, 'total_received',       'Cada R$ 100 recebidos',       5,  100, true),
    (NEW.id, 'agreement_created',    'Acordo formalizado',          0,  1, true),
    (NEW.id, 'agreement_paid',       'Acordo totalmente quitado',  30,  1, true),
    (NEW.id, 'agreement_break',      'Quebra de acordo',           -3,  1, true),
    (NEW.id, 'achievement_unlocked', 'Conquista desbloqueada',     50,  1, true),
    (NEW.id, 'goal_reached',         'Meta do mês atingida',      100,  1, true)
  ON CONFLICT (tenant_id, metric) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_scoring_rules_on_tenant ON public.tenants;
CREATE TRIGGER seed_scoring_rules_on_tenant
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.seed_default_scoring_rules();

-- 4) Refatorar RPC de recálculo para usar regras configuráveis + agreement_paid
CREATE OR REPLACE FUNCTION public.recalculate_operator_gamification_snapshot(
  _operator_profile_id uuid, _year integer, _month integer
)
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

  IF _operator_user_id IS NOT NULL THEN
    SELECT
      COUNT(*),
      COALESCE(SUM(COALESCE(
        (ce.metadata->>'valor_pago')::numeric,
        (ce.metadata->>'amount_paid')::numeric,
        0
      )), 0)
    INTO _payments_count, _total_received
    FROM public.client_events ce
    JOIN public.agreements a
      ON a.id = NULLIF(ce.metadata->>'agreement_id','')::uuid
    WHERE ce.tenant_id = _tenant_id
      AND ce.event_type IN ('payment_confirmed', 'manual_payment_confirmed')
      AND ce.created_at >= _month_start
      AND ce.created_at < _next_month
      AND a.created_by = _operator_user_id;

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

  -- Aplicar regras configuráveis do tenant
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
$function$;