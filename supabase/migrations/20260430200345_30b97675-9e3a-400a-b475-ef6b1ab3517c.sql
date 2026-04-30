
-- =========================================================
-- Analytics & Credit Fixes (no DDL on tables, only functions)
-- =========================================================

-- 1) get_bi_channel_performance: bloqueia 'boleto/pix/cartao' como canal,
--    sanitiza _channel, e filtra eventos sem operador quando _operator_ids vier setado.
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
RETURNS TABLE(
  channel text,
  qtd_interacoes integer,
  qtd_clientes_unicos integer,
  qtd_acordos_atribuidos integer,
  taxa_conversao numeric,
  total_recebido_atribuido numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF NOT public.can_access_tenant(_tenant_id) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  -- Sanitização: canal só pode ser 'whatsapp' ou 'voice'.
  -- Bloqueia tentativas de filtrar por método de pagamento como canal (boleto/pix/cartao/manual/portal).
  IF _channel IS NOT NULL THEN
    SELECT NULLIF(ARRAY(SELECT c FROM unnest(_channel) c WHERE c IN ('whatsapp','voice')), '{}')
      INTO _channel;
  END IF;

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
      -- Filtro estrito: quando há operador selecionado, eventos sem operador NÃO entram.
      AND (_operator_ids IS NULL OR (evt_operator IS NOT NULL AND evt_operator = ANY(_operator_ids)))
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

-- 2) get_bi_response_time_by_channel: filtro estrito por operador (sem fallback NULL).
--    Mantém a assinatura. Reescrita com mesma lógica original + sanitização e filtro estrito.
CREATE OR REPLACE FUNCTION public.get_bi_response_time_by_channel(
  _tenant_id uuid,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL,
  _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL,
  _score_min integer DEFAULT NULL,
  _score_max integer DEFAULT NULL
)
RETURNS TABLE(
  channel text,
  avg_response_seconds numeric,
  p50_seconds numeric,
  p90_seconds numeric,
  qtd_amostras integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF NOT public.can_access_tenant(_tenant_id) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  IF _channel IS NOT NULL THEN
    SELECT NULLIF(ARRAY(SELECT c FROM unnest(_channel) c WHERE c IN ('whatsapp','voice')), '{}')
      INTO _channel;
  END IF;

  RETURN QUERY
  WITH ev AS (
    SELECT
      ce.client_cpf,
      ce.created_at,
      CASE
        WHEN ce.event_type IN ('whatsapp_inbound') THEN 'whatsapp_in'
        WHEN ce.event_type IN ('whatsapp_outbound','message_sent') THEN 'whatsapp_out'
        WHEN ce.event_type IN ('call') THEN 'voice_in'
        WHEN ce.event_type IN ('call_hangup','disposition') THEN 'voice_out'
        ELSE NULL
      END AS dir,
      CASE
        WHEN ce.event_type IN ('whatsapp_inbound','whatsapp_outbound','message_sent') THEN 'whatsapp'
        WHEN ce.event_type IN ('call','call_hangup','disposition') THEN 'voice'
        ELSE NULL
      END AS ch,
      NULLIF(ce.metadata->>'created_by','')::uuid AS evt_operator
    FROM public.client_events ce
    WHERE ce.tenant_id = _tenant_id
      AND ce.event_type IN (
        'whatsapp_inbound','whatsapp_outbound','message_sent',
        'call','call_hangup','disposition'
      )
      AND (_date_from IS NULL OR ce.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR ce.created_at::date <= _date_to)
  ),
  ev_f AS (
    SELECT * FROM ev
    WHERE ch IS NOT NULL
      AND (_channel IS NULL OR ch = ANY(_channel))
      AND (_operator_ids IS NULL OR (evt_operator IS NOT NULL AND evt_operator = ANY(_operator_ids)))
  ),
  pairs AS (
    SELECT
      e.client_cpf, e.ch, e.created_at AS in_at,
      (SELECT MIN(o.created_at) FROM ev_f o
        WHERE o.client_cpf = e.client_cpf
          AND o.ch = e.ch
          AND o.dir IN ('whatsapp_out','voice_out')
          AND o.created_at > e.created_at
          AND o.created_at <= e.created_at + INTERVAL '24 hours'
      ) AS out_at
    FROM ev_f e
    WHERE e.dir IN ('whatsapp_in','voice_in')
  ),
  resp AS (
    SELECT ch, EXTRACT(EPOCH FROM (out_at - in_at))::numeric AS dur
    FROM pairs WHERE out_at IS NOT NULL
  )
  SELECT
    ch::text,
    ROUND(AVG(dur), 2)::numeric,
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY dur)::numeric, 2),
    ROUND(percentile_cont(0.9) WITHIN GROUP (ORDER BY dur)::numeric, 2),
    COUNT(*)::int
  FROM resp
  GROUP BY ch
  ORDER BY ch;
END;
$function$;

-- 3) get_bi_breakage_analysis: usa updated_at como data de quebra (status='cancelled').
--    agreements.cancelled_at não existe → usamos updated_at como aproximação.
CREATE OR REPLACE FUNCTION public.get_bi_breakage_analysis(
  _tenant_id uuid,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL,
  _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL,
  _score_min integer DEFAULT NULL,
  _score_max integer DEFAULT NULL
)
RETURNS TABLE(motivo text, qtd_motivo integer, valor_perdido numeric, pct_motivo numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF NOT public.can_access_tenant(_tenant_id) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  -- Janela: data efetiva da quebra. Como a coluna cancelled_at não existe na tabela,
  -- usamos updated_at filtrando status='cancelled' como aproximação documentada.
  RETURN QUERY
  WITH base AS (
    SELECT a.cancellation_type, a.proposed_total
    FROM public.agreements a
    WHERE a.tenant_id = _tenant_id
      AND a.status = 'cancelled'
      AND (_date_from IS NULL OR a.updated_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.updated_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  tot AS (SELECT COUNT(*)::numeric AS t FROM base)
  SELECT COALESCE(b.cancellation_type,'sem_motivo')::text,
         COUNT(*)::int,
         COALESCE(SUM(b.proposed_total),0)::numeric,
         CASE WHEN tot.t > 0
           THEN ROUND((COUNT(*)::numeric / tot.t) * 100, 2)
           ELSE 0
         END::numeric
  FROM base b, tot
  GROUP BY b.cancellation_type, tot.t
  ORDER BY 2 DESC;
END;
$function$;

-- 4) apply_agreement_credit_on_cancel: inclui status 'vencido' no FIFO.
CREATE OR REPLACE FUNCTION public.apply_agreement_credit_on_cancel(_agreement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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

  SELECT EXISTS (
    SELECT 1 FROM public.client_events ce
    WHERE ce.tenant_id = v_agreement.tenant_id
      AND ce.client_cpf = v_agreement.client_cpf
      AND ce.event_type = 'previous_agreement_credit_applied'
      AND ce.metadata->>'source_agreement_id' = _agreement_id::text
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('status','already_applied','agreement_id',_agreement_id);
  END IF;

  SELECT COALESCE(SUM(mp.amount_paid),0)::numeric INTO v_manual
  FROM public.manual_payments mp
  WHERE mp.agreement_id = _agreement_id AND mp.status IN ('confirmed','approved');

  SELECT COALESCE(SUM(pp.amount),0)::numeric INTO v_portal
  FROM public.portal_payments pp
  WHERE pp.agreement_id = _agreement_id AND pp.status = 'paid';

  SELECT COALESCE(SUM(nc.valor_pago),0)::numeric INTO v_negociarie
  FROM public.negociarie_cobrancas nc
  WHERE nc.agreement_id = _agreement_id AND nc.status = 'pago';

  v_total := ROUND(COALESCE(v_manual,0) + COALESCE(v_portal,0) + COALESCE(v_negociarie,0), 2);
  v_remaining := v_total;

  IF v_total <= 0.005 THEN
    RETURN jsonb_build_object('status','no_payments','agreement_id',_agreement_id,'total_credit',0);
  END IF;

  -- FIFO: títulos pendentes, em_acordo OU vencidos. NUNCA 'pago'.
  FOR v_title IN
    SELECT id, valor_parcela, valor_pago, valor_pago_origem
    FROM public.clients
    WHERE tenant_id = v_agreement.tenant_id
      AND credor = v_agreement.credor
      AND regexp_replace(COALESCE(cpf,''), '\D', '', 'g')
          = regexp_replace(COALESCE(v_agreement.client_cpf,''), '\D', '', 'g')
      AND status IN ('pendente','em_acordo','vencido')
    ORDER BY data_vencimento ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0.005;

    v_credit := LEAST(
      v_remaining,
      GREATEST(COALESCE(v_title.valor_parcela,0) - COALESCE(v_title.valor_pago,0), 0)
    );

    IF v_credit <= 0.005 THEN CONTINUE; END IF;

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
          'source','agreement_credit',
          'source_agreement_id', _agreement_id,
          'amount', ROUND(v_credit, 2),
          'applied_at', now(),
          'applied_by', v_user_id,
          'note','Abatimento de acordo quebrado'
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

  INSERT INTO public.client_events(
    tenant_id, client_cpf, event_type, event_source, event_value, metadata
  ) VALUES (
    v_agreement.tenant_id, v_agreement.client_cpf,
    'previous_agreement_credit_applied','system', v_total::text,
    jsonb_build_object(
      'source_agreement_id', _agreement_id,
      'credor', v_agreement.credor,
      'total_credited', v_total,
      'breakdown', jsonb_build_object('manual',v_manual,'portal',v_portal,'negociarie',v_negociarie),
      'applied_to_titles', v_applied,
      'overflow', v_overflow,
      'applied_by', v_user_id
    )
  );

  IF v_overflow > 0.005 THEN
    INSERT INTO public.client_events(
      tenant_id, client_cpf, event_type, event_source, event_value, metadata
    ) VALUES (
      v_agreement.tenant_id, v_agreement.client_cpf,
      'credit_overflow','system', v_overflow::text,
      jsonb_build_object(
        'source_agreement_id', _agreement_id,
        'credor', v_agreement.credor,
        'overflow_amount', v_overflow,
        'note','Crédito do acordo cancelado excedeu o saldo pendente. Tratar manualmente.'
      )
    );
  END IF;

  INSERT INTO public.audit_logs(
    tenant_id, user_id, action, entity_type, entity_id, details
  ) VALUES (
    v_agreement.tenant_id, v_user_id,
    'agreement_credit_applied','agreement', _agreement_id::text,
    jsonb_build_object(
      'total_credited', v_total,
      'overflow', v_overflow,
      'breakdown', jsonb_build_object('manual',v_manual,'portal',v_portal,'negociarie',v_negociarie),
      'applied_to_titles', v_applied
    )
  );

  RETURN jsonb_build_object(
    'status','applied',
    'agreement_id', _agreement_id,
    'total_credit', v_total,
    'breakdown', jsonb_build_object('manual',v_manual,'portal',v_portal,'negociarie',v_negociarie),
    'applied_to', v_applied,
    'overflow', v_overflow
  );
END;
$function$;
