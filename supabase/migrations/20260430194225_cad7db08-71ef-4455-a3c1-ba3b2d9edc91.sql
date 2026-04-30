-- =====================================================================
-- Helper central de acesso a tenant + guards padronizados em RPCs do BI
-- Remove dependência de profiles.role = 'super_admin'
-- =====================================================================

-- 1) Helper central
CREATE OR REPLACE FUNCTION public.can_access_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _tenant_id IS NOT NULL
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.tenant_id = _tenant_id AND tu.user_id = auth.uid()
      )
    );
$$;
GRANT EXECUTE ON FUNCTION public.can_access_tenant(uuid) TO authenticated;


-- 2) get_bi_channel_performance — guard novo + lógica corrigida
-- Receita por canal usa data efetiva de pagamento (não created_at do acordo).
-- Interações reais excluem eventos administrativos.
-- Inclui evento 'call' como Voz.
-- Crédito de acordo quebrado (previous_agreement_credit_applied/credit_overflow) NÃO entra.
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
  IF NOT public.can_access_tenant(_tenant_id) THEN
    RAISE EXCEPTION 'forbidden tenant';
  END IF;

  -- NOTA: Crédito de acordo quebrado (previous_agreement_credit_applied / credit_overflow)
  -- NÃO é receita nem interação. Não entra em nenhuma soma.
  RETURN QUERY
  WITH
  -- Eventos de canal "reais" (sem ruído administrativo)
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
      ce.created_by AS evt_operator
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
    SELECT channel,
           COUNT(*)::int AS qtd_interacoes,
           COUNT(DISTINCT client_cpf)::int AS qtd_unicos
    FROM ev GROUP BY channel
  ),
  -- Pagamentos no período (3 fontes), por DATA EFETIVA
  pay AS (
    SELECT mp.agreement_id, mp.amount_paid::numeric AS pago, mp.payment_date::date AS pago_em
    FROM public.manual_payments mp
    WHERE mp.tenant_id = _tenant_id
      AND mp.status IN ('confirmed','approved')
      AND (_date_from IS NULL OR mp.payment_date >= _date_from)
      AND (_date_to   IS NULL OR mp.payment_date <= _date_to)
    UNION ALL
    SELECT pp.agreement_id, pp.amount::numeric, pp.updated_at::date
    FROM public.portal_payments pp
    WHERE pp.tenant_id = _tenant_id
      AND pp.status = 'paid'
      AND (_date_from IS NULL OR pp.updated_at::date >= _date_from)
      AND (_date_to   IS NULL OR pp.updated_at::date <= _date_to)
    UNION ALL
    SELECT nc.agreement_id, nc.valor_pago::numeric, nc.data_pagamento
    FROM public.negociarie_cobrancas nc
    WHERE nc.tenant_id = _tenant_id
      AND nc.status = 'pago'
      AND nc.data_pagamento IS NOT NULL
      AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
      AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
  ),
  -- Aplica filtro credor/operador via acordo
  pay_filt AS (
    SELECT p.agreement_id, p.pago, p.pago_em, a.client_cpf
    FROM pay p
    JOIN public.agreements a ON a.id = p.agreement_id AND a.tenant_id = _tenant_id
    WHERE (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  -- Atribuição: último evento de canal anterior à data de pagamento
  pay_ch AS (
    SELECT pf.agreement_id, pf.pago,
      (SELECT e.channel FROM ev_raw e
        WHERE e.channel IS NOT NULL
          AND e.client_cpf = pf.client_cpf
          AND e.created_at::date <= pf.pago_em
        ORDER BY e.created_at DESC LIMIT 1) AS channel
    FROM pay_filt pf
  ),
  -- Recebido por canal (filtro _channel também aplicado aqui)
  recebido AS (
    SELECT channel, SUM(pago)::numeric AS total_recebido
    FROM pay_ch
    WHERE channel IS NOT NULL
      AND (_channel IS NULL OR channel = ANY(_channel))
    GROUP BY channel
  ),
  -- Acordos no período (para taxa de conversão)
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


-- 3) get_bi_breakage_analysis — guard novo, janela única (created_at)
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
RETURNS TABLE (motivo text, qtd_motivo integer, valor_perdido numeric, pct_motivo numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF NOT public.can_access_tenant(_tenant_id) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  -- Janela única: acordos cancelados criados no período (alinha com taxa de quebra).
  RETURN QUERY
  WITH base AS (
    SELECT a.cancellation_type, a.proposed_total
    FROM public.agreements a
    WHERE a.tenant_id = _tenant_id
      AND a.status = 'cancelled'
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
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
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_breakage_analysis(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 4) get_bi_breakage_by_operator — guard novo, janela única (created_at)
CREATE OR REPLACE FUNCTION public.get_bi_breakage_by_operator(
  _tenant_id uuid,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL,
  _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL,
  _score_min integer DEFAULT NULL,
  _score_max integer DEFAULT NULL
)
RETURNS TABLE (operator_id uuid, operator_name text, qtd_acordos integer, qtd_quebras integer, taxa_quebra numeric, valor_perdido numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF NOT public.can_access_tenant(_tenant_id) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  -- Numerador e denominador na MESMA janela (a.created_at).
  -- valor_perdido segue como soma de proposed_total dos cancelados.
  RETURN QUERY
  WITH ag_total AS (
    SELECT a.created_by, COUNT(*)::int AS qtd_acordos
    FROM public.agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
    GROUP BY a.created_by
  ),
  ag_break AS (
    SELECT a.created_by,
           COUNT(*)::int AS qtd_quebras,
           COALESCE(SUM(a.proposed_total),0)::numeric AS valor_perdido
    FROM public.agreements a
    WHERE a.tenant_id = _tenant_id
      AND a.status = 'cancelled'
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
    GROUP BY a.created_by
  ),
  ops AS (
    SELECT created_by FROM ag_total
    UNION
    SELECT created_by FROM ag_break
  )
  SELECT
    o.created_by,
    COALESCE(p.full_name,'Operador não vinculado')::text,
    COALESCE(at_.qtd_acordos,0),
    COALESCE(ab.qtd_quebras,0),
    CASE WHEN COALESCE(at_.qtd_acordos,0) > 0
      THEN ROUND((COALESCE(ab.qtd_quebras,0)::numeric / at_.qtd_acordos) * 100, 2)
      ELSE 0
    END::numeric,
    COALESCE(ab.valor_perdido,0)::numeric
  FROM ops o
  LEFT JOIN ag_total at_ ON at_.created_by = o.created_by
  LEFT JOIN ag_break ab  ON ab.created_by  = o.created_by
  LEFT JOIN public.profiles p ON p.user_id = o.created_by AND p.tenant_id = _tenant_id
  ORDER BY 4 DESC, 3 DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_breakage_by_operator(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 5) get_bi_recurrence_analysis — guard novo
CREATE OR REPLACE FUNCTION public.get_bi_recurrence_analysis(
  _tenant_id uuid,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL,
  _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL,
  _score_min integer DEFAULT NULL,
  _score_max integer DEFAULT NULL
)
RETURNS TABLE (cpf_distintos integer, devedores_recorrentes integer, taxa_recorrencia numeric, top_cpfs jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF NOT public.can_access_tenant(_tenant_id) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      regexp_replace(COALESCE(a.client_cpf,''), '\D', '', 'g') AS cpf_norm,
      a.client_name,
      a.proposed_total
    FROM public.agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  base_ok AS (SELECT * FROM base WHERE cpf_norm <> ''),
  agg AS (
    SELECT cpf_norm, MAX(client_name) AS nome,
           COUNT(*)::int AS qtd_acordos,
           COALESCE(SUM(proposed_total),0)::numeric AS total_negociado
    FROM base_ok GROUP BY cpf_norm
  ),
  totals AS (SELECT COUNT(*)::int AS d, COUNT(*) FILTER (WHERE qtd_acordos > 1)::int AS r FROM agg),
  top AS (
    SELECT jsonb_agg(jsonb_build_object(
      'cpf', cpf_norm, 'nome', nome,
      'qtd_acordos', qtd_acordos, 'total_negociado', total_negociado
    ) ORDER BY qtd_acordos DESC, total_negociado DESC) AS j
    FROM (SELECT * FROM agg ORDER BY qtd_acordos DESC, total_negociado DESC LIMIT 20) s
  )
  SELECT t.d, t.r,
         CASE WHEN t.d > 0 THEN ROUND((t.r::numeric / t.d) * 100, 2) ELSE 0 END::numeric,
         COALESCE(top.j, '[]'::jsonb)
  FROM totals t, top;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_recurrence_analysis(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 6) get_bi_response_time_by_channel — adiciona guard que NÃO existia
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
RETURNS TABLE (channel text, avg_response_seconds numeric, p50_seconds numeric, p90_seconds numeric, qtd_amostras integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF NOT public.can_access_tenant(_tenant_id) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  RETURN QUERY
  WITH msgs AS (
    SELECT m.conversation_id, m.direction, m.created_at,
           COALESCE(c.channel_type, m.provider, 'whatsapp') AS channel
    FROM public.chat_messages m
    LEFT JOIN public.conversations c ON c.id = m.conversation_id AND c.tenant_id = _tenant_id
    WHERE m.tenant_id = _tenant_id AND m.direction IN ('inbound','outbound')
      AND (_date_from IS NULL OR m.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR m.created_at::date <= _date_to)
      AND (_channel   IS NULL OR COALESCE(c.channel_type, m.provider, 'whatsapp') = ANY(_channel))
  ),
  ranked AS (
    SELECT channel, conversation_id, direction, created_at,
           LEAD(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_at,
           LEAD(direction) OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_dir
    FROM msgs
  ),
  pairs AS (
    SELECT channel, EXTRACT(EPOCH FROM (next_at - created_at))::numeric AS resp_s
    FROM ranked
    WHERE direction = 'inbound' AND next_dir = 'outbound' AND next_at IS NOT NULL
  )
  SELECT channel,
    ROUND(AVG(resp_s)::numeric, 2),
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY resp_s)::numeric, 2),
    ROUND(percentile_cont(0.9) WITHIN GROUP (ORDER BY resp_s)::numeric, 2),
    COUNT(*)::int
  FROM pairs
  WHERE resp_s >= 0 AND resp_s <= 14400
  GROUP BY channel
  ORDER BY 2;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_response_time_by_channel(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 7) get_distinct_credores — guard novo
CREATE OR REPLACE FUNCTION public.get_distinct_credores(_tenant_id uuid)
RETURNS TABLE(credor text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF NOT public.can_access_tenant(_tenant_id) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  RETURN QUERY
  SELECT DISTINCT c.credor
  FROM public.clients c
  WHERE c.tenant_id = _tenant_id
    AND c.credor IS NOT NULL
    AND c.credor <> ''
  ORDER BY c.credor;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_distinct_credores(uuid) TO authenticated;