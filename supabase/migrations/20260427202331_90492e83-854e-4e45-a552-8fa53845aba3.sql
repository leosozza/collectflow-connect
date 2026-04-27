
-- 1. Novas colunas
ALTER TABLE public.gamification_campaigns
  ADD COLUMN IF NOT EXISTS points_first integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_second integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_third integer NOT NULL DEFAULT 0;

ALTER TABLE public.operator_goals
  ADD COLUMN IF NOT EXISTS points_reward integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_awarded boolean NOT NULL DEFAULT false;

ALTER TABLE public.operator_points
  ADD COLUMN IF NOT EXISTS bonus_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted_to_coins boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- 2. RPC: garantir que existe linha em operator_points para o operador no mês corrente, e somar bonus
CREATE OR REPLACE FUNCTION public.add_operator_bonus_points(
  _tenant_id uuid,
  _operator_id uuid,
  _year integer,
  _month integer,
  _amount integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount IS NULL OR _amount = 0 THEN RETURN; END IF;

  INSERT INTO public.operator_points (tenant_id, operator_id, year, month, points, bonus_points)
  VALUES (_tenant_id, _operator_id, _year, _month, 0, _amount)
  ON CONFLICT (tenant_id, operator_id, year, month)
  DO UPDATE SET bonus_points = public.operator_points.bonus_points + _amount,
                updated_at = now();
END;
$$;

-- Garantir unique para o ON CONFLICT acima
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'operator_points_tenant_op_period_uq'
  ) THEN
    ALTER TABLE public.operator_points
      ADD CONSTRAINT operator_points_tenant_op_period_uq
      UNIQUE (tenant_id, operator_id, year, month);
  END IF;
END $$;

-- 3. RPC: encerrar campanha e premiar top 3
CREATE OR REPLACE FUNCTION public.close_campaign_and_award_points(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    WHERE campaign_id = _campaign_id AND tenant_id = v_camp.tenant_id
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
    v_winners := v_winners || jsonb_build_object('position', v_pos, 'operator_id', r.operator_id, 'points', v_pts);
  END LOOP;

  UPDATE public.gamification_campaigns SET status = 'completed', updated_at = now() WHERE id = _campaign_id;

  RETURN jsonb_build_object('campaign_id', _campaign_id, 'winners', v_winners);
END;
$$;

-- 4. RPC: conversão mensal Pontos -> Rivo Coins (1:1)
CREATE OR REPLACE FUNCTION public.convert_monthly_points_to_rivocoins(_year integer, _month integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_total int;
  v_processed int := 0;
  v_credited int := 0;
BEGIN
  FOR r IN
    SELECT op.id, op.tenant_id, op.operator_id, (op.points + op.bonus_points) AS total
    FROM public.operator_points op
    WHERE op.year = _year AND op.month = _month AND op.converted_to_coins = false
  LOOP
    v_processed := v_processed + 1;
    v_total := COALESCE(r.total, 0);

    IF v_total > 0 THEN
      -- Inserir transação
      INSERT INTO public.rivocoin_transactions
        (tenant_id, profile_id, amount, type, description, reference_type, reference_id)
      VALUES
        (r.tenant_id, r.operator_id, v_total, 'earn',
         format('Conversão mensal %s/%s', _month, _year),
         'monthly_conversion', r.id);

      -- Atualizar/criar carteira
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

-- Garantir unique em rivocoin_wallets para o ON CONFLICT acima
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rivocoin_wallets_tenant_profile_uq'
  ) THEN
    ALTER TABLE public.rivocoin_wallets
      ADD CONSTRAINT rivocoin_wallets_tenant_profile_uq
      UNIQUE (tenant_id, profile_id);
  END IF;
END $$;

-- 5. Cron job mensal (dia 1 às 00:05) para converter mês anterior
DO $$ BEGIN
  PERFORM cron.unschedule('convert-monthly-points-to-rivocoins');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'convert-monthly-points-to-rivocoins',
  '5 0 1 * *',
  $cron$
    SELECT public.convert_monthly_points_to_rivocoins(
      EXTRACT(YEAR FROM (CURRENT_DATE - INTERVAL '1 day'))::int,
      EXTRACT(MONTH FROM (CURRENT_DATE - INTERVAL '1 day'))::int
    );
  $cron$
);
