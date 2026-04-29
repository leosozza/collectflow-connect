-- Corrige pontuação de campanhas e contagens de acordos usando tenant explícito
-- em vez de depender de auth.uid() dentro de recálculos administrativos/automáticos.

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
        AND nc.status = 'pago'
        AND nc.data_pagamento >= _start_date
        AND nc.data_pagamento <= _end_date
        AND a.created_by = _operator_user_id
        AND (_credor_names IS NULL OR a.credor = ANY(_credor_names))
    ), 0);

  RETURN _total;
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
        WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
          AND pp.updated_at >= _start_date::timestamptz
          AND pp.updated_at <  (_end_date + 1)::timestamptz), 0)
    + COALESCE((SELECT SUM(nc.valor_pago)
        FROM public.negociarie_cobrancas nc JOIN ags ON ags.id = nc.agreement_id
        WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago'
          AND nc.data_pagamento >= _start_date
          AND nc.data_pagamento <= _end_date), 0)
  INTO _total;

  RETURN _total;
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
    _campaign.tenant_id = public.get_my_tenant_id()
    OR public.is_tenant_admin(auth.uid(), _campaign.tenant_id)
    OR public.is_super_admin(auth.uid())
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

GRANT EXECUTE ON FUNCTION public.get_operator_received_total_for_tenant(uuid, uuid, date, date, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_operator_negotiated_and_received_for_tenant(uuid, uuid, date, date, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_campaign_scores(uuid) TO authenticated, service_role;
