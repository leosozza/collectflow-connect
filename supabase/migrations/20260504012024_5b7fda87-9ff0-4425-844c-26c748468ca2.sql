CREATE OR REPLACE FUNCTION public.get_operator_received_total_for_tenant(
  _tenant_id uuid,
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
  _total numeric := 0;
BEGIN
  IF _tenant_id IS NULL OR _operator_user_id IS NULL THEN
    RETURN 0;
  END IF;

  _total :=
    COALESCE((
      SELECT SUM(mp.amount_paid)
      FROM public.manual_payments mp
      JOIN public.agreements a ON a.id = mp.agreement_id
      WHERE mp.tenant_id = _tenant_id
        AND a.tenant_id = _tenant_id
        AND mp.status IN ('confirmed','approved')
        AND mp.payment_date >= _start_date
        AND mp.payment_date <= _end_date
        AND a.created_by = _operator_user_id
        AND (_credor_names IS NULL OR a.credor = ANY(_credor_names))
    ), 0)
    + COALESCE((
      SELECT SUM(pp.amount)
      FROM public.portal_payments pp
      JOIN public.agreements a ON a.id = pp.agreement_id
      WHERE pp.tenant_id = _tenant_id
        AND a.tenant_id = _tenant_id
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
      WHERE nc.tenant_id = _tenant_id
        AND a.tenant_id = _tenant_id
        AND nc.status = 'pago'
        AND nc.data_pagamento >= _start_date
        AND nc.data_pagamento <= _end_date
        AND a.created_by = _operator_user_id
        AND (_credor_names IS NULL OR a.credor = ANY(_credor_names))
    ), 0);

  RETURN COALESCE(_total, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_operator_negotiated_and_received_for_tenant(
  _tenant_id uuid,
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
  _total numeric := 0;
BEGIN
  IF _tenant_id IS NULL OR _operator_user_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH ags AS (
    SELECT id, client_cpf, credor
    FROM public.agreements
    WHERE tenant_id = _tenant_id
      AND created_by = _operator_user_id
      AND status NOT IN ('rejected','cancelled')
      AND created_at >= _start_date::timestamptz
      AND created_at <  (_end_date + 1)::timestamptz
      AND (_credor_names IS NULL OR credor = ANY(_credor_names))
  )
  SELECT
      COALESCE((SELECT SUM(mp.amount_paid)
        FROM public.manual_payments mp JOIN ags ON ags.id = mp.agreement_id
        WHERE mp.tenant_id = _tenant_id
          AND mp.status IN ('confirmed','approved')
          AND mp.payment_date >= _start_date
          AND mp.payment_date <= _end_date), 0)
    + COALESCE((SELECT SUM(pp.amount)
        FROM public.portal_payments pp JOIN ags ON ags.id = pp.agreement_id
        WHERE pp.tenant_id = _tenant_id
          AND pp.status = 'paid'
          AND pp.updated_at >= _start_date::timestamptz
          AND pp.updated_at <  (_end_date + 1)::timestamptz), 0)
    + COALESCE((SELECT SUM(nc.valor_pago)
        FROM public.negociarie_cobrancas nc JOIN ags ON ags.id = nc.agreement_id
        WHERE nc.tenant_id = _tenant_id
          AND nc.status = 'pago'
          AND nc.data_pagamento >= _start_date
          AND nc.data_pagamento <= _end_date), 0)
  INTO _total;

  RETURN COALESCE(_total, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_campaign_scores(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _campaign record;
  _participant record;
  _credor_names text[];
  _auth_uid uuid;
  _score numeric;
  _updated integer := 0;
BEGIN
  SELECT * INTO _campaign
  FROM public.gamification_campaigns
  WHERE id = _campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campanha não encontrada';
  END IF;

  IF NOT (
    public.can_access_tenant(_campaign.tenant_id)
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Sem permissão para recalcular esta campanha';
  END IF;

  SELECT array_agg(cr.razao_social) INTO _credor_names
  FROM public.campaign_credores cc
  INNER JOIN public.credores cr ON cr.id = cc.credor_id
  WHERE cc.campaign_id = _campaign.id
    AND cc.tenant_id = _campaign.tenant_id;

  FOR _participant IN
    SELECT cp.id, cp.operator_id, p.user_id
    FROM public.campaign_participants cp
    LEFT JOIN public.profiles p ON p.id = cp.operator_id
    WHERE cp.campaign_id = _campaign.id
      AND cp.tenant_id = _campaign.tenant_id
  LOOP
    _auth_uid := COALESCE(_participant.user_id, _participant.operator_id);
    _score := 0;

    IF _campaign.metric = 'maior_valor_recebido' THEN
      _score := public.get_operator_received_total_for_tenant(
        _campaign.tenant_id, _auth_uid, _campaign.start_date, _campaign.end_date, _credor_names
      );

    ELSIF _campaign.metric = 'negociado_e_recebido' THEN
      _score := public.get_operator_negotiated_and_received_for_tenant(
        _campaign.tenant_id, _auth_uid, _campaign.start_date, _campaign.end_date, _credor_names
      );

    ELSIF _campaign.metric = 'maior_qtd_acordos' THEN
      SELECT COUNT(*) INTO _score
      FROM public.agreements a
      WHERE a.tenant_id = _campaign.tenant_id
        AND a.created_by = _auth_uid
        AND a.status NOT IN ('rejected','cancelled')
        AND a.created_at >= _campaign.start_date::timestamptz
        AND a.created_at < (_campaign.end_date + 1)::timestamptz
        AND (_credor_names IS NULL OR a.credor = ANY(_credor_names));

    ELSIF _campaign.metric = 'menor_taxa_quebra' THEN
      DECLARE
        _total integer := 0;
        _breaks integer := 0;
      BEGIN
        SELECT COUNT(*) INTO _total
        FROM public.agreements a
        WHERE a.tenant_id = _campaign.tenant_id
          AND a.created_by = _auth_uid
          AND a.created_at >= _campaign.start_date::timestamptz
          AND a.created_at < (_campaign.end_date + 1)::timestamptz
          AND (_credor_names IS NULL OR a.credor = ANY(_credor_names));

        IF COALESCE(_total, 0) = 0 THEN
          _score := 100;
        ELSE
          SELECT COUNT(*) INTO _breaks
          FROM public.agreements a
          WHERE a.tenant_id = _campaign.tenant_id
            AND a.created_by = _auth_uid
            AND a.status = 'cancelled'
            AND a.updated_at >= _campaign.start_date::timestamptz
            AND a.updated_at < (_campaign.end_date + 1)::timestamptz
            AND (_credor_names IS NULL OR a.credor = ANY(_credor_names));
          _score := GREATEST(0, 100 - (COALESCE(_breaks, 0)::numeric / _total::numeric) * 100);
        END IF;
      END;

    ELSIF _campaign.metric = 'menor_valor_quebra' THEN
      SELECT GREATEST(0, 1000000 - COALESCE(SUM(a.proposed_total), 0)) INTO _score
      FROM public.agreements a
      WHERE a.tenant_id = _campaign.tenant_id
        AND a.created_by = _auth_uid
        AND a.status = 'cancelled'
        AND a.updated_at >= _campaign.start_date::timestamptz
        AND a.updated_at < (_campaign.end_date + 1)::timestamptz
        AND (_credor_names IS NULL OR a.credor = ANY(_credor_names));

    ELSIF _campaign.metric = 'maior_valor_promessas' THEN
      SELECT COALESCE(SUM(a.proposed_total), 0) INTO _score
      FROM public.agreements a
      WHERE a.tenant_id = _campaign.tenant_id
        AND a.created_by = _auth_uid
        AND a.status IN ('pending','approved')
        AND a.created_at >= _campaign.start_date::timestamptz
        AND a.created_at < (_campaign.end_date + 1)::timestamptz
        AND (_credor_names IS NULL OR a.credor = ANY(_credor_names));
    ELSE
      _score := public.get_operator_received_total_for_tenant(
        _campaign.tenant_id, _auth_uid, _campaign.start_date, _campaign.end_date, _credor_names
      );
    END IF;

    UPDATE public.campaign_participants
    SET score = COALESCE(_score, 0), updated_at = now()
    WHERE id = _participant.id;

    _updated := _updated + 1;
  END LOOP;

  RETURN jsonb_build_object('campaign_id', _campaign_id, 'updated', _updated);
END;
$$;

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
  IF v_camp.status IN ('completed') THEN RAISE EXCEPTION 'Campanha já encerrada'; END IF;

  PERFORM public.recalculate_campaign_scores(_campaign_id);

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

  UPDATE public.gamification_campaigns
  SET status = CASE WHEN status = 'encerrada' THEN status ELSE 'completed' END,
      updated_at = now()
  WHERE id = _campaign_id;

  RETURN jsonb_build_object('campaign_id', _campaign_id, 'winners', v_winners);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_operator_received_total_for_tenant(uuid, uuid, date, date, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_operator_negotiated_and_received_for_tenant(uuid, uuid, date, date, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_campaign_scores(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_campaign_and_award_points(uuid) TO authenticated, service_role;

DO $$
DECLARE
  _campaign_id uuid;
BEGIN
  FOR _campaign_id IN
    SELECT id
    FROM public.gamification_campaigns
    WHERE status IN ('ativa','encerrada','completed')
      AND metric IN ('maior_valor_recebido','negociado_e_recebido','maior_qtd_acordos','menor_taxa_quebra','menor_valor_quebra','maior_valor_promessas')
  LOOP
    PERFORM public.recalculate_campaign_scores(_campaign_id);
  END LOOP;
END $$;