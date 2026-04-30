-- =====================================================================
-- (a) Hotfix em get_bi_channel_performance — client_events não tem created_by
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_bi_channel_performance(
  _tenant_id uuid,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL,
  _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL,
  _score_min integer DEFAULT NULL,
  _score_max integer DEFAULT NULL
)
RETURNS TABLE (
  channel text,
  qtd_interacoes integer,
  qtd_clientes_unicos integer,
  qtd_acordos_atribuidos integer,
  taxa_conversao numeric,
  total_recebido_atribuido numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF NOT public.can_access_tenant(_tenant_id) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  RETURN QUERY
  WITH
  ev_raw AS (
    SELECT
      ce.client_cpf,
      ce.created_at,
      CASE
        WHEN ce.event_type IN ('whatsapp_inbound','whatsapp_outbound','message_sent') THEN 'whatsapp'
        WHEN ce.event_type IN ('disposition','call_hangup','call') THEN 'voice'
        ELSE NULL
      END AS channel,
      (ce.metadata->>'credor')::text AS evt_credor,
      NULLIF(ce.metadata->>'created_by','')::uuid AS evt_operator
    FROM public.client_events ce
    WHERE ce.tenant_id = _tenant_id
      AND ce.event_type IN (
        'whatsapp_inbound','whatsapp_outbound','message_sent',
        'disposition','call_hangup','call'
      )
      AND (_date_from IS NULL OR ce.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR ce.created_at::date <= _date_to)
  ),
  ev AS (
    SELECT * FROM ev_raw
    WHERE channel IS NOT NULL
      AND (_channel IS NULL OR channel = ANY(_channel))
      AND (_credor IS NULL OR evt_credor IS NULL OR evt_credor = ANY(_credor))
      AND (_operator_ids IS NULL OR evt_operator IS NULL OR evt_operator = ANY(_operator_ids))
  ),
  inter AS (
    SELECT channel, COUNT(*)::int AS qtd_interacoes,
           COUNT(DISTINCT client_cpf)::int AS qtd_unicos
    FROM ev GROUP BY channel
  ),
  pay AS (
    SELECT mp.agreement_id, mp.amount_paid::numeric AS pago, mp.payment_date::date AS pago_em
    FROM public.manual_payments mp
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
      AND (_date_from IS NULL OR mp.payment_date >= _date_from)
      AND (_date_to   IS NULL OR mp.payment_date <= _date_to)
    UNION ALL
    SELECT pp.agreement_id, pp.amount::numeric, pp.updated_at::date
    FROM public.portal_payments pp
    WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
      AND (_date_from IS NULL OR pp.updated_at::date >= _date_from)
      AND (_date_to   IS NULL OR pp.updated_at::date <= _date_to)
    UNION ALL
    SELECT nc.agreement_id, nc.valor_pago::numeric, nc.data_pagamento
    FROM public.negociarie_cobrancas nc
    WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago' AND nc.data_pagamento IS NOT NULL
      AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
      AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
  ),
  pay_filt AS (
    SELECT p.agreement_id, p.pago, p.pago_em, a.client_cpf
    FROM pay p
    JOIN public.agreements a ON a.id = p.agreement_id AND a.tenant_id = _tenant_id
    WHERE (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  pay_ch AS (
    SELECT pf.agreement_id, pf.pago,
      (SELECT e.channel FROM ev_raw e
        WHERE e.channel IS NOT NULL
          AND e.client_cpf = pf.client_cpf
          AND e.created_at::date <= pf.pago_em
        ORDER BY e.created_at DESC LIMIT 1) AS channel
    FROM pay_filt pf
  ),
  recebido AS (
    SELECT channel, SUM(pago)::numeric AS total_recebido
    FROM pay_ch
    WHERE channel IS NOT NULL
      AND (_channel IS NULL OR channel = ANY(_channel))
    GROUP BY channel
  ),
  ag AS (
    SELECT a.id, a.client_cpf, a.created_at
    FROM public.agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  ag_attr AS (
    SELECT a.id,
      (SELECT e.channel FROM ev_raw e
        WHERE e.channel IS NOT NULL
          AND e.client_cpf = a.client_cpf
          AND e.created_at <= a.created_at
        ORDER BY e.created_at DESC LIMIT 1) AS channel
    FROM ag a
  ),
  ag_ch AS (
    SELECT channel, COUNT(*)::int AS qtd_acordos
    FROM ag_attr
    WHERE channel IS NOT NULL
      AND (_channel IS NULL OR channel = ANY(_channel))
    GROUP BY channel
  )
  SELECT
    i.channel,
    i.qtd_interacoes,
    i.qtd_unicos,
    COALESCE(ac.qtd_acordos,0)::int,
    CASE WHEN i.qtd_unicos > 0
      THEN ROUND((COALESCE(ac.qtd_acordos,0)::numeric / i.qtd_unicos) * 100, 2)
      ELSE 0
    END::numeric,
    COALESCE(r.total_recebido, 0)::numeric
  FROM inter i
  LEFT JOIN ag_ch ac ON ac.channel = i.channel
  LEFT JOIN recebido r ON r.channel = i.channel
  ORDER BY i.qtd_interacoes DESC;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_bi_channel_performance(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- =====================================================================
-- (b) RPC transacional para creditar pagamentos de acordo cancelado
--     ao saldo original (clients), com idempotência real.
--
--     Fontes incluídas: manual_payments (confirmed/approved),
--     portal_payments (paid), negociarie_cobrancas (pago).
--     Distribuição FIFO por data_vencimento em clients.
--     valor_pago_origem é apenso (jsonb), nada é reescrito.
--     Crédito é abatimento — não é receita nova.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.apply_agreement_credit_on_cancel(_agreement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_agreement record;
  v_total numeric := 0;
  v_manual numeric := 0;
  v_portal numeric := 0;
  v_negociarie numeric := 0;
  v_remaining numeric;
  v_applied jsonb := '[]'::jsonb;
  v_overflow numeric := 0;
  v_already boolean := false;
  v_title record;
  v_credit numeric;
  v_new_pago numeric;
  v_is_paid boolean;
  v_existing_origem jsonb;
  v_user_id uuid := auth.uid();
BEGIN
  IF _agreement_id IS NULL THEN
    RAISE EXCEPTION 'agreement_id obrigatório';
  END IF;

  -- Lock do acordo
  SELECT a.id, a.tenant_id, a.client_cpf, a.credor
    INTO v_agreement
  FROM public.agreements a
  WHERE a.id = _agreement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agreement não encontrado';
  END IF;

  IF NOT public.can_access_tenant(v_agreement.tenant_id) THEN
    RAISE EXCEPTION 'forbidden tenant';
  END IF;

  -- Idempotência transacional: já creditado para este acordo?
  SELECT EXISTS (
    SELECT 1 FROM public.client_events ce
    WHERE ce.tenant_id = v_agreement.tenant_id
      AND ce.client_cpf = v_agreement.client_cpf
      AND ce.event_type = 'previous_agreement_credit_applied'
      AND ce.metadata->>'source_agreement_id' = _agreement_id::text
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object(
      'status', 'already_applied',
      'agreement_id', _agreement_id
    );
  END IF;

  -- Soma das fontes
  SELECT COALESCE(SUM(mp.amount_paid),0)::numeric INTO v_manual
  FROM public.manual_payments mp
  WHERE mp.agreement_id = _agreement_id
    AND mp.status IN ('confirmed','approved');

  SELECT COALESCE(SUM(pp.amount),0)::numeric INTO v_portal
  FROM public.portal_payments pp
  WHERE pp.agreement_id = _agreement_id
    AND pp.status = 'paid';

  SELECT COALESCE(SUM(nc.valor_pago),0)::numeric INTO v_negociarie
  FROM public.negociarie_cobrancas nc
  WHERE nc.agreement_id = _agreement_id
    AND nc.status = 'pago';

  v_total := ROUND(COALESCE(v_manual,0) + COALESCE(v_portal,0) + COALESCE(v_negociarie,0), 2);
  v_remaining := v_total;

  IF v_total <= 0.005 THEN
    -- Marca evento de "no_op" para não tentar de novo? Não: se houver pagamento futuro
    -- o cancelamento já está consumado e não faz sentido. Apenas retorna.
    RETURN jsonb_build_object(
      'status', 'no_payments',
      'agreement_id', _agreement_id,
      'total_credit', 0
    );
  END IF;

  -- Distribui FIFO em clients (lock por linha)
  FOR v_title IN
    SELECT id, valor_parcela, valor_pago, valor_pago_origem
    FROM public.clients
    WHERE tenant_id = v_agreement.tenant_id
      AND credor = v_agreement.credor
      AND regexp_replace(COALESCE(cpf,''), '\D', '', 'g')
          = regexp_replace(COALESCE(v_agreement.client_cpf,''), '\D', '', 'g')
      AND status IN ('pendente','em_acordo')
    ORDER BY data_vencimento ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0.005;

    v_credit := LEAST(
      v_remaining,
      GREATEST(COALESCE(v_title.valor_parcela,0) - COALESCE(v_title.valor_pago,0), 0)
    );

    IF v_credit <= 0.005 THEN
      CONTINUE;
    END IF;

    v_new_pago := COALESCE(v_title.valor_pago,0) + v_credit;
    v_is_paid := v_new_pago >= COALESCE(v_title.valor_parcela,0) - 0.005;

    v_existing_origem := COALESCE(
      CASE WHEN jsonb_typeof(v_title.valor_pago_origem) = 'array'
           THEN v_title.valor_pago_origem
           ELSE '[]'::jsonb
      END,
      '[]'::jsonb
    );

    UPDATE public.clients
    SET valor_pago = v_new_pago,
        valor_pago_origem = v_existing_origem || jsonb_build_array(jsonb_build_object(
          'source', 'agreement_credit',
          'source_agreement_id', _agreement_id,
          'amount', ROUND(v_credit, 2),
          'applied_at', now(),
          'applied_by', v_user_id,
          'note', 'Abatimento de acordo quebrado'
        )),
        status = CASE WHEN v_is_paid THEN 'pago' ELSE status END,
        data_quitacao = CASE WHEN v_is_paid THEN CURRENT_DATE ELSE data_quitacao END,
        updated_at = now()
    WHERE id = v_title.id;

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'client_id', v_title.id,
      'amount', ROUND(v_credit, 2)
    ));
    v_remaining := v_remaining - v_credit;
  END LOOP;

  v_overflow := ROUND(GREATEST(v_remaining, 0), 2);

  -- Timeline: crédito aplicado
  INSERT INTO public.client_events(
    tenant_id, client_cpf, event_type, event_source, event_value, metadata
  ) VALUES (
    v_agreement.tenant_id,
    v_agreement.client_cpf,
    'previous_agreement_credit_applied',
    'system',
    v_total::text,
    jsonb_build_object(
      'source_agreement_id', _agreement_id,
      'credor', v_agreement.credor,
      'total_credited', v_total,
      'breakdown', jsonb_build_object(
        'manual', v_manual,
        'portal', v_portal,
        'negociarie', v_negociarie
      ),
      'applied_to_titles', v_applied,
      'overflow', v_overflow,
      'applied_by', v_user_id
    )
  );

  -- Overflow audit
  IF v_overflow > 0.005 THEN
    INSERT INTO public.client_events(
      tenant_id, client_cpf, event_type, event_source, event_value, metadata
    ) VALUES (
      v_agreement.tenant_id,
      v_agreement.client_cpf,
      'credit_overflow',
      'system',
      v_overflow::text,
      jsonb_build_object(
        'source_agreement_id', _agreement_id,
        'credor', v_agreement.credor,
        'overflow_amount', v_overflow,
        'note', 'Crédito do acordo cancelado excedeu o saldo pendente. Tratar manualmente.'
      )
    );
  END IF;

  -- Auditoria
  INSERT INTO public.audit_logs(
    tenant_id, user_id, action, entity_type, entity_id, details
  ) VALUES (
    v_agreement.tenant_id,
    v_user_id,
    'agreement_credit_applied',
    'agreement',
    _agreement_id::text,
    jsonb_build_object(
      'total_credited', v_total,
      'overflow', v_overflow,
      'breakdown', jsonb_build_object(
        'manual', v_manual,
        'portal', v_portal,
        'negociarie', v_negociarie
      ),
      'applied_to_titles', v_applied
    )
  );

  RETURN jsonb_build_object(
    'status', 'applied',
    'agreement_id', _agreement_id,
    'total_credit', v_total,
    'breakdown', jsonb_build_object(
      'manual', v_manual,
      'portal', v_portal,
      'negociarie', v_negociarie
    ),
    'applied_to', v_applied,
    'overflow', v_overflow
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_agreement_credit_on_cancel(uuid) TO authenticated;