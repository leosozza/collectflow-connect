CREATE OR REPLACE FUNCTION public.recalculate_campaign_scores(_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    ELSIF _campaign.metric = 'maior_valor_primeira_parcela' THEN
      SELECT COALESCE(SUM(
        CASE
          WHEN COALESCE(a.entrada_value, 0) > 0 THEN a.entrada_value
          WHEN jsonb_typeof(a.custom_installment_values) = 'array'
               AND jsonb_array_length(a.custom_installment_values) > 0
               AND COALESCE((a.custom_installment_values->>0)::numeric, 0) > 0
            THEN (a.custom_installment_values->>0)::numeric
          ELSE COALESCE(a.new_installment_value, 0)
        END
      ), 0) INTO _score
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
$function$;