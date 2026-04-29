BEGIN;

-- 1. RECEITA -------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_bi_revenue_summary(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (
  total_negociado numeric, total_recebido numeric, total_pendente numeric, total_quebra numeric,
  ticket_medio numeric, qtd_acordos integer, qtd_acordos_ativos integer, qtd_quebras integer
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT a.id, a.proposed_total, a.status FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  pagos AS (
    SELECT mp.agreement_id, SUM(mp.amount_paid) AS pago FROM manual_payments mp
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
    GROUP BY mp.agreement_id
  )
  SELECT
    COALESCE(SUM(b.proposed_total),0)::numeric,
    COALESCE(SUM(p.pago),0)::numeric,
    GREATEST(COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status<>'cancelled'),0)
             - COALESCE(SUM(p.pago),0), 0)::numeric,
    COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status='cancelled'),0)::numeric,
    CASE WHEN COUNT(*) FILTER (WHERE b.status<>'cancelled')>0
         THEN COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status<>'cancelled'),0)
              / COUNT(*) FILTER (WHERE b.status<>'cancelled') ELSE 0 END::numeric,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE b.status<>'cancelled')::int,
    COUNT(*) FILTER (WHERE b.status='cancelled')::int
  FROM base b LEFT JOIN pagos p ON p.agreement_id = b.id;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_revenue_summary(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_revenue_by_period(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL,
  _granularity text DEFAULT 'month'
) RETURNS TABLE (period date, total_negociado numeric, total_recebido numeric, qtd_acordos integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT a.id, a.proposed_total, a.created_at FROM agreements a
    WHERE a.tenant_id = _tenant_id AND a.status <> 'cancelled'
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  pagos AS (
    SELECT mp.agreement_id, SUM(mp.amount_paid) AS pago FROM manual_payments mp
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
    GROUP BY mp.agreement_id
  )
  SELECT
    date_trunc(CASE WHEN _granularity IN ('day','week','month') THEN _granularity ELSE 'month' END,
               b.created_at)::date,
    COALESCE(SUM(b.proposed_total),0)::numeric,
    COALESCE(SUM(p.pago),0)::numeric,
    COUNT(*)::int
  FROM base b LEFT JOIN pagos p ON p.agreement_id = b.id
  GROUP BY 1 ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_revenue_by_period(uuid,date,date,text[],uuid[],text[],integer,integer,text) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_revenue_by_credor(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (
  credor text, total_negociado numeric, total_recebido numeric,
  total_pendente numeric, qtd_acordos integer, ticket_medio numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT a.id, a.credor, a.proposed_total, a.status FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  pagos AS (
    SELECT mp.agreement_id, SUM(mp.amount_paid) AS pago FROM manual_payments mp
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
    GROUP BY mp.agreement_id
  )
  SELECT b.credor,
    COALESCE(SUM(b.proposed_total),0)::numeric,
    COALESCE(SUM(p.pago),0)::numeric,
    GREATEST(COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status<>'cancelled'),0)
             - COALESCE(SUM(p.pago),0),0)::numeric,
    COUNT(*)::int,
    CASE WHEN COUNT(*) FILTER (WHERE b.status<>'cancelled')>0
         THEN COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status<>'cancelled'),0)
              / COUNT(*) FILTER (WHERE b.status<>'cancelled') ELSE 0 END::numeric
  FROM base b LEFT JOIN pagos p ON p.agreement_id = b.id
  GROUP BY b.credor ORDER BY 2 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_revenue_by_credor(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_revenue_comparison(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (metric text, current_value numeric, previous_value numeric, delta_abs numeric, delta_pct numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE(_date_from, (CURRENT_DATE - INTERVAL '30 days')::date);
  v_to   date := COALESCE(_date_to,   CURRENT_DATE);
  v_span int  := GREATEST((v_to - v_from) + 1, 1);
  v_prev_to   date := (v_from - INTERVAL '1 day')::date;
  v_prev_from date := (v_prev_to - (v_span - 1))::date;
BEGIN
  RETURN QUERY
  WITH cur AS (SELECT * FROM public.get_bi_revenue_summary(_tenant_id,v_from,v_to,_credor,_operator_ids,_channel,_score_min,_score_max)),
       prv AS (SELECT * FROM public.get_bi_revenue_summary(_tenant_id,v_prev_from,v_prev_to,_credor,_operator_ids,_channel,_score_min,_score_max))
  SELECT m.metric, m.cur_v, m.prv_v,
         (m.cur_v - m.prv_v)::numeric,
         CASE WHEN m.prv_v=0 THEN NULL ELSE ROUND(((m.cur_v - m.prv_v)/m.prv_v)*100,2) END::numeric
  FROM (
    SELECT 'recebido'::text AS metric, c.total_recebido AS cur_v, p.total_recebido AS prv_v FROM cur c, prv p
    UNION ALL SELECT 'negociado',     c.total_negociado,         p.total_negociado         FROM cur c, prv p
    UNION ALL SELECT 'qtd_acordos',   c.qtd_acordos::numeric,    p.qtd_acordos::numeric    FROM cur c, prv p
    UNION ALL SELECT 'ticket_medio',  c.ticket_medio,            p.ticket_medio            FROM cur c, prv p
  ) m;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_bi_revenue_comparison(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 2. QUALIDADE ----------------------------------------------

CREATE OR REPLACE FUNCTION public.get_bi_breakage_analysis(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (motivo text, qtd_motivo integer, valor_perdido numeric, pct_motivo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT a.cancellation_type, a.proposed_total FROM agreements a
    WHERE a.tenant_id = _tenant_id AND a.status='cancelled'
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  tot AS (SELECT COUNT(*)::numeric AS t FROM base)
  SELECT COALESCE(b.cancellation_type,'sem_motivo')::text,
         COUNT(*)::int,
         COALESCE(SUM(b.proposed_total),0)::numeric,
         CASE WHEN tot.t>0 THEN ROUND((COUNT(*)::numeric/tot.t)*100,2) ELSE 0 END::numeric
  FROM base b, tot
  GROUP BY b.cancellation_type, tot.t ORDER BY 2 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_breakage_analysis(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_breakage_by_operator(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (operator_id uuid, operator_name text, qtd_acordos integer, qtd_quebras integer, taxa_quebra numeric, valor_perdido numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT a.created_by, a.proposed_total, a.status FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  )
  SELECT b.created_by, COALESCE(p.full_name,'Desconhecido')::text,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE b.status='cancelled')::int,
         CASE WHEN COUNT(*)>0 THEN ROUND((COUNT(*) FILTER (WHERE b.status='cancelled')::numeric/COUNT(*))*100,2) ELSE 0 END::numeric,
         COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status='cancelled'),0)::numeric
  FROM base b LEFT JOIN profiles p ON p.user_id=b.created_by AND p.tenant_id=_tenant_id
  GROUP BY b.created_by, p.full_name ORDER BY 4 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_breakage_by_operator(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_recurrence_analysis(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (cpf_distintos integer, devedores_recorrentes integer, taxa_recorrencia numeric, top_cpfs jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT a.client_cpf, a.client_name, a.proposed_total FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  agg AS (
    SELECT client_cpf, MAX(client_name) AS nome, COUNT(*)::int AS qtd_acordos,
           COALESCE(SUM(proposed_total),0)::numeric AS total_negociado
    FROM base GROUP BY client_cpf
  ),
  totals AS (
    SELECT COUNT(*)::int AS d, COUNT(*) FILTER (WHERE qtd_acordos>1)::int AS r FROM agg
  ),
  top AS (
    SELECT jsonb_agg(jsonb_build_object(
      'cpf',client_cpf,'nome',nome,'qtd_acordos',qtd_acordos,'total_negociado',total_negociado
    ) ORDER BY qtd_acordos DESC, total_negociado DESC) AS j
    FROM (SELECT * FROM agg ORDER BY qtd_acordos DESC, total_negociado DESC LIMIT 20) s
  )
  SELECT t.d, t.r,
    CASE WHEN t.d>0 THEN ROUND((t.r::numeric/t.d)*100,2) ELSE 0 END::numeric,
    COALESCE(top.j,'[]'::jsonb)
  FROM totals t, top;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_recurrence_analysis(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 3. FUNIL --------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_bi_collection_funnel(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (stage text, stage_order integer, qtd integer, conversao_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cli AS (
    SELECT DISTINCT c.cpf FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_credor    IS NULL OR c.credor = ANY(_credor))
      AND (_score_min IS NULL OR c.propensity_score >= _score_min)
      AND (_score_max IS NULL OR c.propensity_score <= _score_max)
  ),
  contato AS (
    SELECT DISTINCT ce.client_cpf AS cpf FROM client_events ce
    WHERE ce.tenant_id = _tenant_id
      AND (_date_from IS NULL OR ce.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR ce.created_at::date <= _date_to)
      AND (_channel   IS NULL OR ce.event_channel = ANY(_channel))
  ),
  negociacao AS (
    SELECT DISTINCT s.client_cpf AS cpf FROM atendimento_sessions s
    WHERE s.tenant_id = _tenant_id
      AND (_date_from IS NULL OR s.opened_at::date >= _date_from)
      AND (_date_to   IS NULL OR s.opened_at::date <= _date_to)
      AND (_credor    IS NULL OR s.credor = ANY(_credor))
  ),
  acordo AS (
    SELECT DISTINCT a.client_cpf AS cpf FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from    IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to      IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  pago AS (
    SELECT DISTINCT a.client_cpf AS cpf FROM agreements a
    JOIN manual_payments mp ON mp.agreement_id = a.id
    WHERE a.tenant_id = _tenant_id AND mp.tenant_id = _tenant_id
      AND mp.status IN ('confirmed','approved')
      AND (_date_from    IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to      IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  counts AS (
    SELECT (SELECT COUNT(*) FROM cli) AS c1, (SELECT COUNT(*) FROM contato) AS c2,
           (SELECT COUNT(*) FROM negociacao) AS c3, (SELECT COUNT(*) FROM acordo) AS c4,
           (SELECT COUNT(*) FROM pago) AS c5
  )
  SELECT s.stage, s.stage_order, s.qtd::int,
    CASE WHEN s.prev IS NULL OR s.prev=0 THEN NULL ELSE ROUND((s.qtd::numeric/s.prev)*100,2) END::numeric
  FROM (
    SELECT 'cadastro'::text AS stage, 1 AS stage_order, c1 AS qtd, NULL::bigint AS prev FROM counts
    UNION ALL SELECT 'contato',    2, c2, c1 FROM counts
    UNION ALL SELECT 'negociacao', 3, c3, c2 FROM counts
    UNION ALL SELECT 'acordo',     4, c4, c3 FROM counts
    UNION ALL SELECT 'pagamento',  5, c5, c4 FROM counts
  ) s ORDER BY s.stage_order;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_collection_funnel(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_funnel_dropoff(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (credor text, stage text, qtd integer, dropoff_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cli AS (
    SELECT c.credor, COUNT(DISTINCT c.cpf)::int AS qtd FROM clients c
    WHERE c.tenant_id = _tenant_id AND (_credor IS NULL OR c.credor = ANY(_credor))
    GROUP BY c.credor
  ),
  acordo AS (
    SELECT a.credor, COUNT(DISTINCT a.client_cpf)::int AS qtd FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
    GROUP BY a.credor
  ),
  pago AS (
    SELECT a.credor, COUNT(DISTINCT a.client_cpf)::int AS qtd FROM agreements a
    JOIN manual_payments mp ON mp.agreement_id = a.id
    WHERE a.tenant_id = _tenant_id AND mp.tenant_id = _tenant_id
      AND mp.status IN ('confirmed','approved')
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
    GROUP BY a.credor
  ),
  joined AS (
    SELECT COALESCE(cli.credor, acordo.credor, pago.credor) AS credor,
           COALESCE(cli.qtd,0) AS q_cli,
           COALESCE(acordo.qtd,0) AS q_acordo,
           COALESCE(pago.qtd,0) AS q_pago
    FROM cli FULL OUTER JOIN acordo ON acordo.credor=cli.credor
             FULL OUTER JOIN pago   ON pago.credor=COALESCE(cli.credor,acordo.credor)
  )
  SELECT j.credor, s.stage, s.qtd,
    CASE WHEN s.prev IS NULL OR s.prev=0 THEN NULL ELSE ROUND((1-(s.qtd::numeric/s.prev))*100,2) END::numeric
  FROM joined j
  CROSS JOIN LATERAL (VALUES
    ('cadastro'::text,1,j.q_cli,NULL::int),
    ('acordo',2,j.q_acordo,j.q_cli),
    ('pagamento',3,j.q_pago,j.q_acordo)
  ) s(stage,ord,qtd,prev)
  ORDER BY j.credor, s.ord;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_funnel_dropoff(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 4. PERFORMANCE --------------------------------------------

CREATE OR REPLACE FUNCTION public.get_bi_operator_performance(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (operator_id uuid, operator_name text, qtd_acordos integer, total_recebido numeric,
                 qtd_calls integer, qtd_cpc integer, taxa_cpc numeric, qtd_quebras integer, taxa_quebra numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ag AS (
    SELECT a.id, a.created_by, a.proposed_total, a.status FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  pagos AS (
    SELECT mp.agreement_id, SUM(mp.amount_paid) AS pago FROM manual_payments mp
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
    GROUP BY mp.agreement_id
  ),
  ag_op AS (
    SELECT a.created_by AS op, COUNT(*)::int AS qtd_acordos,
           COUNT(*) FILTER (WHERE a.status='cancelled')::int AS qtd_quebras,
           COALESCE(SUM(p.pago),0)::numeric AS total_recebido
    FROM ag a LEFT JOIN pagos p ON p.agreement_id=a.id
    GROUP BY a.created_by
  ),
  calls AS (
    SELECT CASE WHEN cl.operator_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN cl.operator_id::uuid ELSE NULL END AS op,
           COUNT(*)::int AS qtd_calls
    FROM call_logs cl
    WHERE cl.tenant_id = _tenant_id
      AND (_date_from IS NULL OR cl.called_at::date >= _date_from)
      AND (_date_to   IS NULL OR cl.called_at::date <= _date_to)
    GROUP BY 1
  ),
  cpc AS (
    SELECT cd.operator_id AS op, COUNT(*)::int AS qtd_cpc
    FROM call_dispositions cd
    JOIN call_disposition_types t ON t.tenant_id=cd.tenant_id AND t.key=cd.disposition_type AND t.is_cpc=true
    WHERE cd.tenant_id = _tenant_id
      AND (_date_from IS NULL OR cd.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR cd.created_at::date <= _date_to)
    GROUP BY cd.operator_id
  ),
  ops AS (
    SELECT op FROM ag_op WHERE op IS NOT NULL
    UNION SELECT op FROM calls WHERE op IS NOT NULL
    UNION SELECT op FROM cpc   WHERE op IS NOT NULL
  )
  SELECT o.op, COALESCE(p.full_name,'Desconhecido')::text,
    COALESCE(ag_op.qtd_acordos,0), COALESCE(ag_op.total_recebido,0),
    COALESCE(calls.qtd_calls,0),   COALESCE(cpc.qtd_cpc,0),
    CASE WHEN COALESCE(calls.qtd_calls,0)>0 THEN ROUND((COALESCE(cpc.qtd_cpc,0)::numeric/calls.qtd_calls)*100,2) ELSE 0 END::numeric,
    COALESCE(ag_op.qtd_quebras,0),
    CASE WHEN COALESCE(ag_op.qtd_acordos,0)>0 THEN ROUND((COALESCE(ag_op.qtd_quebras,0)::numeric/ag_op.qtd_acordos)*100,2) ELSE 0 END::numeric
  FROM ops o
  LEFT JOIN ag_op ON ag_op.op=o.op
  LEFT JOIN calls ON calls.op=o.op
  LEFT JOIN cpc   ON cpc.op=o.op
  LEFT JOIN profiles p ON p.user_id=o.op AND p.tenant_id=_tenant_id
  WHERE (_operator_ids IS NULL OR o.op = ANY(_operator_ids))
  ORDER BY 4 DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_operator_performance(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_operator_efficiency(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (operator_id uuid, operator_name text, talk_time_seconds bigint,
                 qtd_chamadas integer, qtd_conversoes integer, conv_rate numeric, acordos_por_hora numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH calls AS (
    SELECT CASE WHEN cl.operator_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN cl.operator_id::uuid ELSE NULL END AS op,
           COALESCE(SUM(cl.duration_seconds),0)::bigint AS talk_time,
           COUNT(*)::int AS qtd_chamadas
    FROM call_logs cl
    WHERE cl.tenant_id = _tenant_id
      AND (_date_from IS NULL OR cl.called_at::date >= _date_from)
      AND (_date_to   IS NULL OR cl.called_at::date <= _date_to)
    GROUP BY 1
  ),
  conv AS (
    SELECT cd.operator_id AS op, COUNT(*)::int AS qtd_conv FROM call_dispositions cd
    JOIN call_disposition_types t ON t.tenant_id=cd.tenant_id AND t.key=cd.disposition_type AND t.is_conversion=true
    WHERE cd.tenant_id = _tenant_id
      AND (_date_from IS NULL OR cd.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR cd.created_at::date <= _date_to)
    GROUP BY cd.operator_id
  ),
  ag AS (
    SELECT a.created_by AS op, COUNT(*)::int AS qtd_acordos FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
    GROUP BY a.created_by
  ),
  ops AS (
    SELECT op FROM calls WHERE op IS NOT NULL
    UNION SELECT op FROM conv WHERE op IS NOT NULL
    UNION SELECT op FROM ag   WHERE op IS NOT NULL
  )
  SELECT o.op, COALESCE(p.full_name,'Desconhecido')::text,
    COALESCE(calls.talk_time,0), COALESCE(calls.qtd_chamadas,0), COALESCE(conv.qtd_conv,0),
    CASE WHEN COALESCE(calls.qtd_chamadas,0)>0 THEN ROUND((COALESCE(conv.qtd_conv,0)::numeric/calls.qtd_chamadas)*100,2) ELSE 0 END::numeric,
    CASE WHEN COALESCE(calls.talk_time,0)>0 THEN ROUND(COALESCE(ag.qtd_acordos,0)::numeric/(calls.talk_time::numeric/3600),2) ELSE 0 END::numeric
  FROM ops o
  LEFT JOIN calls ON calls.op=o.op
  LEFT JOIN conv  ON conv.op=o.op
  LEFT JOIN ag    ON ag.op=o.op
  LEFT JOIN profiles p ON p.user_id=o.op AND p.tenant_id=_tenant_id
  WHERE (_operator_ids IS NULL OR o.op = ANY(_operator_ids))
  ORDER BY 6 DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_operator_efficiency(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 5. CANAIS -------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_bi_channel_performance(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (channel text, qtd_interacoes integer, qtd_clientes_unicos integer,
                 qtd_acordos_atribuidos integer, taxa_conversao numeric, total_recebido_atribuido numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ev AS (
    SELECT ce.client_cpf, ce.event_channel AS channel, ce.created_at FROM client_events ce
    WHERE ce.tenant_id = _tenant_id AND ce.event_channel IS NOT NULL
      AND (_date_from IS NULL OR ce.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR ce.created_at::date <= _date_to)
      AND (_channel   IS NULL OR ce.event_channel = ANY(_channel))
  ),
  inter AS (
    SELECT channel, COUNT(*)::int AS qtd_interacoes, COUNT(DISTINCT client_cpf)::int AS qtd_unicos
    FROM ev GROUP BY channel
  ),
  ag AS (
    SELECT a.id, a.client_cpf, a.created_at FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  ag_attr AS (
    SELECT a.id, (SELECT e.channel FROM ev e
                  WHERE e.client_cpf=a.client_cpf AND e.created_at <= a.created_at
                  ORDER BY e.created_at DESC LIMIT 1) AS channel
    FROM ag a
  ),
  pagos AS (
    SELECT mp.agreement_id, SUM(mp.amount_paid) AS pago FROM manual_payments mp
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
    GROUP BY mp.agreement_id
  ),
  ag_ch AS (
    SELECT aa.channel, COUNT(*)::int AS qtd_acordos, COALESCE(SUM(p.pago),0)::numeric AS total_recebido
    FROM ag_attr aa LEFT JOIN pagos p ON p.agreement_id=aa.id
    WHERE aa.channel IS NOT NULL GROUP BY aa.channel
  )
  SELECT i.channel, i.qtd_interacoes, i.qtd_unicos,
    COALESCE(ac.qtd_acordos,0),
    CASE WHEN i.qtd_unicos>0 THEN ROUND((COALESCE(ac.qtd_acordos,0)::numeric/i.qtd_unicos)*100,2) ELSE 0 END::numeric,
    COALESCE(ac.total_recebido,0)
  FROM inter i LEFT JOIN ag_ch ac ON ac.channel=i.channel
  ORDER BY i.qtd_interacoes DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_channel_performance(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_response_time_by_channel(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (channel text, avg_response_seconds numeric, p50_seconds numeric, p90_seconds numeric, qtd_amostras integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH msgs AS (
    SELECT m.conversation_id, m.direction, m.created_at,
           COALESCE(c.channel_type, m.provider, 'whatsapp') AS channel
    FROM chat_messages m
    LEFT JOIN conversations c ON c.id=m.conversation_id AND c.tenant_id=_tenant_id
    WHERE m.tenant_id=_tenant_id AND m.direction IN ('inbound','outbound')
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
    FROM ranked WHERE direction='inbound' AND next_dir='outbound' AND next_at IS NOT NULL
  )
  SELECT channel,
    ROUND(AVG(resp_s)::numeric,2),
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY resp_s)::numeric,2),
    ROUND(percentile_cont(0.9) WITHIN GROUP (ORDER BY resp_s)::numeric,2),
    COUNT(*)::int
  FROM pairs WHERE resp_s>=0 GROUP BY channel ORDER BY 2;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_response_time_by_channel(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 6. SCORE / INTELIGÊNCIA ----------------------------------

CREATE OR REPLACE FUNCTION public.get_bi_score_distribution(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (bucket text, qtd integer, pct numeric, valor_carteira numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT c.propensity_score, COALESCE(c.valor_atualizado, c.valor_parcela, 0) AS val FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_credor    IS NULL OR c.credor = ANY(_credor))
      AND (_score_min IS NULL OR c.propensity_score >= _score_min)
      AND (_score_max IS NULL OR c.propensity_score <= _score_max)
  ),
  buck AS (
    SELECT CASE
      WHEN propensity_score IS NULL THEN 'sem_score'
      WHEN propensity_score BETWEEN 0  AND 20 THEN '0-20'
      WHEN propensity_score BETWEEN 21 AND 40 THEN '21-40'
      WHEN propensity_score BETWEEN 41 AND 60 THEN '41-60'
      WHEN propensity_score BETWEEN 61 AND 80 THEN '61-80'
      ELSE '81-100' END AS bucket, val FROM base
  ),
  tot AS (SELECT COUNT(*)::numeric AS t FROM buck)
  SELECT b.bucket, COUNT(*)::int,
    CASE WHEN tot.t>0 THEN ROUND((COUNT(*)::numeric/tot.t)*100,2) ELSE 0 END::numeric,
    COALESCE(SUM(b.val),0)::numeric
  FROM buck b, tot GROUP BY b.bucket, tot.t ORDER BY b.bucket;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_score_distribution(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_score_vs_result(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL
) RETURNS TABLE (bucket text, qtd_clientes integer, qtd_com_acordo integer, taxa_acordo numeric,
                 qtd_pagos integer, taxa_pagamento numeric, valor_recebido numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cli AS (
    SELECT DISTINCT ON (c.cpf, c.credor)
      c.cpf, c.credor, c.propensity_score,
      CASE
        WHEN c.propensity_score IS NULL THEN 'sem_score'
        WHEN c.propensity_score BETWEEN 0  AND 20 THEN '0-20'
        WHEN c.propensity_score BETWEEN 21 AND 40 THEN '21-40'
        WHEN c.propensity_score BETWEEN 41 AND 60 THEN '41-60'
        WHEN c.propensity_score BETWEEN 61 AND 80 THEN '61-80'
        ELSE '81-100' END AS bucket
    FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_credor    IS NULL OR c.credor = ANY(_credor))
      AND (_score_min IS NULL OR c.propensity_score >= _score_min)
      AND (_score_max IS NULL OR c.propensity_score <= _score_max)
    ORDER BY c.cpf, c.credor, c.created_at DESC
  ),
  ag AS (
    SELECT DISTINCT a.client_cpf, a.credor FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from    IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to      IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  pag AS (
    SELECT a.client_cpf, a.credor, COALESCE(SUM(mp.amount_paid),0)::numeric AS pago
    FROM agreements a JOIN manual_payments mp ON mp.agreement_id=a.id
    WHERE a.tenant_id=_tenant_id AND mp.tenant_id=_tenant_id
      AND mp.status IN ('confirmed','approved')
      AND (_date_from    IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to      IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
    GROUP BY a.client_cpf, a.credor
  )
  SELECT cli.bucket,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE ag.client_cpf IS NOT NULL)::int,
    CASE WHEN COUNT(*)>0 THEN ROUND((COUNT(*) FILTER (WHERE ag.client_cpf IS NOT NULL)::numeric/COUNT(*))*100,2) ELSE 0 END::numeric,
    COUNT(*) FILTER (WHERE pag.pago>0)::int,
    CASE WHEN COUNT(*)>0 THEN ROUND((COUNT(*) FILTER (WHERE pag.pago>0)::numeric/COUNT(*))*100,2) ELSE 0 END::numeric,
    COALESCE(SUM(pag.pago),0)::numeric
  FROM cli
  LEFT JOIN ag  ON ag.client_cpf=cli.cpf  AND ag.credor=cli.credor
  LEFT JOIN pag ON pag.client_cpf=cli.cpf AND pag.credor=cli.credor
  GROUP BY cli.bucket ORDER BY cli.bucket;
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_score_vs_result(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_top_opportunities(
  _tenant_id uuid, _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _credor text[] DEFAULT NULL, _operator_ids uuid[] DEFAULT NULL,
  _channel text[] DEFAULT NULL, _score_min integer DEFAULT NULL, _score_max integer DEFAULT NULL,
  _limit integer DEFAULT 50
) RETURNS TABLE (client_id uuid, cpf text, nome text, credor text, propensity_score integer,
                 valor_atualizado numeric, debtor_profile text, preferred_channel text, ultimo_contato timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cli AS (
    SELECT DISTINCT ON (c.cpf, c.credor)
      c.id, c.cpf, c.nome_completo, c.credor, c.propensity_score,
      COALESCE(c.valor_atualizado, c.valor_parcela, 0) AS valor_atualizado,
      c.debtor_profile, c.preferred_channel
    FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_credor    IS NULL OR c.credor = ANY(_credor))
      AND (_score_min IS NULL OR c.propensity_score >= _score_min)
      AND (_score_max IS NULL OR c.propensity_score <= _score_max)
      AND (_operator_ids IS NULL OR c.operator_id = ANY(_operator_ids))
      AND NOT EXISTS (
        SELECT 1 FROM agreements a
        WHERE a.tenant_id=_tenant_id AND a.client_cpf=c.cpf AND a.credor=c.credor
          AND a.status NOT IN ('cancelled','rejected','completed')
      )
    ORDER BY c.cpf, c.credor, c.created_at DESC
  )
  SELECT cli.id, cli.cpf, cli.nome_completo, cli.credor, cli.propensity_score,
    cli.valor_atualizado, cli.debtor_profile::text, cli.preferred_channel,
    (SELECT MAX(ce.created_at) FROM client_events ce
     WHERE ce.tenant_id=_tenant_id AND ce.client_cpf=cli.cpf
       AND (_channel IS NULL OR ce.event_channel = ANY(_channel)))
  FROM cli
  ORDER BY cli.propensity_score DESC NULLS LAST, cli.valor_atualizado DESC NULLS LAST
  LIMIT GREATEST(COALESCE(_limit,50),1);
$$;
GRANT EXECUTE ON FUNCTION public.get_bi_top_opportunities(uuid,date,date,text[],uuid[],text[],integer,integer,integer) TO authenticated;

COMMIT;