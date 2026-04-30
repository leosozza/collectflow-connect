
-- =====================================================================
-- Fix BI Analytics RPCs: include portal_payments + negociarie_cobrancas
-- and filter received amounts by actual payment date (not agreement date)
-- =====================================================================

-- 1) get_bi_revenue_summary
CREATE OR REPLACE FUNCTION public.get_bi_revenue_summary(_tenant_id uuid, _date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date, _credor text[] DEFAULT NULL::text[], _operator_ids uuid[] DEFAULT NULL::uuid[], _channel text[] DEFAULT NULL::text[], _score_min integer DEFAULT NULL::integer, _score_max integer DEFAULT NULL::integer)
RETURNS TABLE(total_negociado numeric, total_recebido numeric, total_pendente numeric, total_quebra numeric, ticket_medio numeric, qtd_acordos integer, qtd_acordos_ativos integer, qtd_quebras integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT a.id, a.proposed_total, a.status, a.credor, a.created_by FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  -- All received payments in the filter window, from 3 sources, by payment date
  all_paid AS (
    SELECT mp.amount_paid::numeric AS pago, mp.payment_date::date AS pago_em,
           mp.agreement_id
    FROM manual_payments mp
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
      AND (_date_from IS NULL OR mp.payment_date >= _date_from)
      AND (_date_to   IS NULL OR mp.payment_date <= _date_to)
    UNION ALL
    SELECT pp.amount::numeric, pp.updated_at::date, pp.agreement_id
    FROM portal_payments pp
    WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
      AND (_date_from IS NULL OR pp.updated_at::date >= _date_from)
      AND (_date_to   IS NULL OR pp.updated_at::date <= _date_to)
    UNION ALL
    SELECT nc.valor_pago::numeric, nc.data_pagamento, nc.agreement_id
    FROM negociarie_cobrancas nc
    WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago' AND nc.data_pagamento IS NOT NULL
      AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
      AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
  ),
  -- Apply credor/operator filter via agreement when available
  paid_filtered AS (
    SELECT ap.pago FROM all_paid ap
    LEFT JOIN agreements a ON a.id = ap.agreement_id AND a.tenant_id = _tenant_id
    WHERE (_credor       IS NULL OR a.credor = ANY(_credor) OR ap.agreement_id IS NULL)
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids) OR ap.agreement_id IS NULL)
  ),
  totals AS (
    SELECT COALESCE(SUM(pago),0)::numeric AS recebido FROM paid_filtered
  )
  SELECT
    COALESCE(SUM(b.proposed_total),0)::numeric,
    (SELECT recebido FROM totals)::numeric,
    GREATEST(COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status<>'cancelled'),0)
             - (SELECT recebido FROM totals), 0)::numeric,
    COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status='cancelled'),0)::numeric,
    CASE WHEN COUNT(*) FILTER (WHERE b.status<>'cancelled')>0
         THEN COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status<>'cancelled'),0)
              / COUNT(*) FILTER (WHERE b.status<>'cancelled') ELSE 0 END::numeric,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE b.status<>'cancelled')::int,
    COUNT(*) FILTER (WHERE b.status='cancelled')::int
  FROM base b;
$function$;

-- 2) get_bi_revenue_by_period
CREATE OR REPLACE FUNCTION public.get_bi_revenue_by_period(_tenant_id uuid, _date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date, _credor text[] DEFAULT NULL::text[], _operator_ids uuid[] DEFAULT NULL::uuid[], _channel text[] DEFAULT NULL::text[], _score_min integer DEFAULT NULL::integer, _score_max integer DEFAULT NULL::integer, _granularity text DEFAULT 'month'::text)
RETURNS TABLE(period date, total_negociado numeric, total_recebido numeric, qtd_acordos integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH gran AS (SELECT CASE WHEN _granularity IN ('day','week','month') THEN _granularity ELSE 'month' END AS g),
  -- Negociado: keyed by agreement.created_at
  neg AS (
    SELECT date_trunc((SELECT g FROM gran), a.created_at)::date AS period,
           SUM(a.proposed_total)::numeric AS total_negociado,
           COUNT(*)::int AS qtd_acordos
    FROM agreements a
    WHERE a.tenant_id = _tenant_id AND a.status <> 'cancelled'
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
    GROUP BY 1
  ),
  -- Recebido: keyed by actual payment date, from 3 sources
  paid AS (
    SELECT mp.payment_date::date AS pago_em, mp.amount_paid::numeric AS pago, mp.agreement_id
    FROM manual_payments mp
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
      AND (_date_from IS NULL OR mp.payment_date >= _date_from)
      AND (_date_to   IS NULL OR mp.payment_date <= _date_to)
    UNION ALL
    SELECT pp.updated_at::date, pp.amount::numeric, pp.agreement_id
    FROM portal_payments pp
    WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
      AND (_date_from IS NULL OR pp.updated_at::date >= _date_from)
      AND (_date_to   IS NULL OR pp.updated_at::date <= _date_to)
    UNION ALL
    SELECT nc.data_pagamento, nc.valor_pago::numeric, nc.agreement_id
    FROM negociarie_cobrancas nc
    WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago' AND nc.data_pagamento IS NOT NULL
      AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
      AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
  ),
  paid_filt AS (
    SELECT date_trunc((SELECT g FROM gran), p.pago_em)::date AS period, SUM(p.pago)::numeric AS total_recebido
    FROM paid p
    LEFT JOIN agreements a ON a.id = p.agreement_id AND a.tenant_id = _tenant_id
    WHERE (_credor       IS NULL OR a.credor = ANY(_credor) OR p.agreement_id IS NULL)
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids) OR p.agreement_id IS NULL)
    GROUP BY 1
  ),
  all_periods AS (SELECT period FROM neg UNION SELECT period FROM paid_filt)
  SELECT ap.period,
         COALESCE(neg.total_negociado, 0),
         COALESCE(paid_filt.total_recebido, 0),
         COALESCE(neg.qtd_acordos, 0)
  FROM all_periods ap
  LEFT JOIN neg ON neg.period = ap.period
  LEFT JOIN paid_filt ON paid_filt.period = ap.period
  ORDER BY ap.period;
$function$;

-- 3) get_bi_revenue_by_credor
CREATE OR REPLACE FUNCTION public.get_bi_revenue_by_credor(_tenant_id uuid, _date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date, _credor text[] DEFAULT NULL::text[], _operator_ids uuid[] DEFAULT NULL::uuid[], _channel text[] DEFAULT NULL::text[], _score_min integer DEFAULT NULL::integer, _score_max integer DEFAULT NULL::integer)
RETURNS TABLE(credor text, total_negociado numeric, total_recebido numeric, total_pendente numeric, qtd_acordos integer, ticket_medio numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT a.id, a.credor, a.proposed_total, a.status FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  paid AS (
    SELECT a.credor, SUM(p.pago)::numeric AS pago FROM (
      SELECT mp.amount_paid::numeric AS pago, mp.agreement_id FROM manual_payments mp
      WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
        AND (_date_from IS NULL OR mp.payment_date >= _date_from)
        AND (_date_to   IS NULL OR mp.payment_date <= _date_to)
      UNION ALL
      SELECT pp.amount::numeric, pp.agreement_id FROM portal_payments pp
      WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
        AND (_date_from IS NULL OR pp.updated_at::date >= _date_from)
        AND (_date_to   IS NULL OR pp.updated_at::date <= _date_to)
      UNION ALL
      SELECT nc.valor_pago::numeric, nc.agreement_id FROM negociarie_cobrancas nc
      WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago' AND nc.data_pagamento IS NOT NULL
        AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
        AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
    ) p
    JOIN agreements a ON a.id = p.agreement_id AND a.tenant_id = _tenant_id
    WHERE (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
    GROUP BY a.credor
  ),
  agg AS (
    SELECT b.credor,
      COALESCE(SUM(b.proposed_total),0)::numeric AS neg,
      COUNT(*)::int AS qtd,
      COUNT(*) FILTER (WHERE b.status<>'cancelled')::int AS qtd_active,
      COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status<>'cancelled'),0)::numeric AS neg_active
    FROM base b GROUP BY b.credor
  )
  SELECT agg.credor,
    agg.neg,
    COALESCE(paid.pago,0)::numeric,
    GREATEST(agg.neg_active - COALESCE(paid.pago,0), 0)::numeric,
    agg.qtd,
    CASE WHEN agg.qtd_active>0 THEN agg.neg_active / agg.qtd_active ELSE 0 END::numeric
  FROM agg LEFT JOIN paid ON paid.credor = agg.credor
  ORDER BY 2 DESC;
$function$;

-- 4) get_bi_collection_funnel — pays now from 3 sources by payment date
CREATE OR REPLACE FUNCTION public.get_bi_collection_funnel(_tenant_id uuid, _date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date, _credor text[] DEFAULT NULL::text[], _operator_ids uuid[] DEFAULT NULL::uuid[], _channel text[] DEFAULT NULL::text[], _score_min integer DEFAULT NULL::integer, _score_max integer DEFAULT NULL::integer)
RETURNS TABLE(stage text, stage_order integer, qtd integer, conversao_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH params AS (
  SELECT
    COALESCE(_date_from, (CURRENT_DATE - INTERVAL '30 days')::date) AS dfrom,
    COALESCE(_date_to,   CURRENT_DATE)                              AS dto
),
client_score AS (
  SELECT DISTINCT ON (c.cpf, c.credor) c.cpf, c.credor, c.propensity_score
  FROM clients c WHERE c.tenant_id = _tenant_id
  ORDER BY c.cpf, c.credor, c.created_at DESC
),
calls AS (
  SELECT DISTINCT cl.cpf, cl.credor, cal.status FROM call_logs cal
  JOIN clients cl ON cl.tenant_id = cal.tenant_id AND cl.cpf = cal.client_cpf
  WHERE cal.tenant_id = _tenant_id
    AND cal.called_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor       IS NULL OR cl.credor          = ANY(_credor))
    AND (_operator_ids IS NULL OR cal.operator_id::uuid = ANY(_operator_ids))
    AND (_channel      IS NULL OR 'voice' = ANY(_channel))
),
msgs AS (
  SELECT DISTINCT cl.cpf, cl.credor, m.direction FROM chat_messages m
  JOIN conversations conv ON conv.id = m.conversation_id AND conv.tenant_id = _tenant_id
  JOIN clients cl ON cl.id = conv.client_id AND cl.tenant_id = _tenant_id
  WHERE m.tenant_id = _tenant_id
    AND m.created_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor  IS NULL OR cl.credor         = ANY(_credor))
    AND (_channel IS NULL OR conv.channel_type = ANY(_channel))
),
sessions AS (
  SELECT DISTINCT s.client_cpf AS cpf, s.credor FROM atendimento_sessions s
  WHERE s.tenant_id = _tenant_id
    AND s.opened_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor       IS NULL OR s.credor          = ANY(_credor))
    AND (_channel      IS NULL OR s.current_channel = ANY(_channel))
    AND (_operator_ids IS NULL OR s.assigned_to     = ANY(_operator_ids))
),
agr AS (
  SELECT DISTINCT a.client_cpf AS cpf, a.credor, a.status FROM agreements a
  WHERE a.tenant_id = _tenant_id
    AND a.created_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND a.status <> 'rejected'
    AND (_credor       IS NULL OR a.credor     = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
),
pays AS (
  SELECT DISTINCT a.client_cpf AS cpf, a.credor FROM (
    SELECT mp.agreement_id FROM manual_payments mp
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
      AND mp.payment_date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    UNION
    SELECT pp.agreement_id FROM portal_payments pp
    WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
      AND pp.updated_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    UNION
    SELECT nc.agreement_id FROM negociarie_cobrancas nc
    WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago'
      AND nc.data_pagamento BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
  ) px
  JOIN agreements a ON a.id = px.agreement_id AND a.tenant_id = _tenant_id
  WHERE (_credor       IS NULL OR a.credor     = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
),
base_raw AS (
  SELECT cpf, credor FROM calls
  UNION SELECT cpf, credor FROM msgs
  UNION SELECT cpf, credor FROM sessions
  UNION SELECT cpf, credor FROM agr
),
base AS (
  SELECT DISTINCT b.cpf, b.credor FROM base_raw b
  LEFT JOIN client_score s ON s.cpf = b.cpf AND s.credor = b.credor
  WHERE b.cpf IS NOT NULL AND b.credor IS NOT NULL
    AND (_score_min IS NULL OR COALESCE(s.propensity_score, 0)   >= _score_min)
    AND (_score_max IS NULL OR COALESCE(s.propensity_score, 100) <= _score_max)
),
contato AS (
  SELECT DISTINCT b.cpf, b.credor FROM base b
  WHERE EXISTS (SELECT 1 FROM calls c WHERE c.cpf=b.cpf AND c.credor=b.credor
                  AND lower(coalesce(c.status,'')) IN ('answered','cpc','connected','completed','atendida'))
     OR EXISTS (SELECT 1 FROM msgs m WHERE m.cpf=b.cpf AND m.credor=b.credor AND m.direction='inbound')
),
negociacao AS (
  SELECT DISTINCT b.cpf, b.credor FROM base b
  WHERE EXISTS (SELECT 1 FROM sessions s WHERE s.cpf=b.cpf AND s.credor=b.credor)
     OR EXISTS (SELECT 1 FROM agr a WHERE a.cpf=b.cpf AND a.credor=b.credor)
),
acordo AS (
  SELECT DISTINCT b.cpf, b.credor FROM base b
  WHERE EXISTS (SELECT 1 FROM agr a WHERE a.cpf=b.cpf AND a.credor=b.credor)
),
pagamento AS (
  SELECT DISTINCT b.cpf, b.credor FROM base b
  WHERE EXISTS (SELECT 1 FROM pays p WHERE p.cpf=b.cpf AND p.credor=b.credor)
),
counts AS (
  SELECT
    (SELECT COUNT(*)::int FROM base)        AS qtd_base,
    (SELECT COUNT(*)::int FROM contato)     AS qtd_contato,
    (SELECT COUNT(*)::int FROM negociacao)  AS qtd_negociacao,
    (SELECT COUNT(*)::int FROM acordo)      AS qtd_acordo,
    (SELECT COUNT(*)::int FROM pagamento)   AS qtd_pagamento
)
SELECT 'base_ativa_periodo'::text, 1, qtd_base, NULL::numeric FROM counts
UNION ALL
SELECT 'contato_efetivo', 2, qtd_contato,
       CASE WHEN qtd_base > 0 THEN ROUND(LEAST(qtd_contato::numeric / qtd_base * 100, 100), 2) ELSE 0 END FROM counts
UNION ALL
SELECT 'negociacao', 3, qtd_negociacao,
       CASE WHEN qtd_base > 0 THEN ROUND(LEAST(qtd_negociacao::numeric / qtd_base * 100, 100), 2) ELSE 0 END FROM counts
UNION ALL
SELECT 'acordo', 4, qtd_acordo,
       CASE WHEN qtd_base > 0 THEN ROUND(LEAST(qtd_acordo::numeric / qtd_base * 100, 100), 2) ELSE 0 END FROM counts
UNION ALL
SELECT 'pagamento', 5, qtd_pagamento,
       CASE WHEN qtd_base > 0 THEN ROUND(LEAST(qtd_pagamento::numeric / qtd_base * 100, 100), 2) ELSE 0 END FROM counts
ORDER BY 2;
$function$;

-- 5) get_bi_funnel_dropoff — same fix on pays CTE
CREATE OR REPLACE FUNCTION public.get_bi_funnel_dropoff(_tenant_id uuid, _date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date, _credor text[] DEFAULT NULL::text[], _operator_ids uuid[] DEFAULT NULL::uuid[], _channel text[] DEFAULT NULL::text[], _score_min integer DEFAULT NULL::integer, _score_max integer DEFAULT NULL::integer)
RETURNS TABLE(credor text, stage text, qtd integer, dropoff_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH params AS (
  SELECT
    COALESCE(_date_from, (CURRENT_DATE - INTERVAL '30 days')::date) AS dfrom,
    COALESCE(_date_to,   CURRENT_DATE)                              AS dto
),
client_score AS (
  SELECT DISTINCT ON (c.cpf, c.credor) c.cpf, c.credor, c.propensity_score
  FROM clients c WHERE c.tenant_id = _tenant_id
  ORDER BY c.cpf, c.credor, c.created_at DESC
),
calls AS (
  SELECT DISTINCT cl.cpf, cl.credor, cal.status FROM call_logs cal
  JOIN clients cl ON cl.tenant_id = cal.tenant_id AND cl.cpf = cal.client_cpf
  WHERE cal.tenant_id = _tenant_id
    AND cal.called_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor       IS NULL OR cl.credor          = ANY(_credor))
    AND (_operator_ids IS NULL OR cal.operator_id::uuid = ANY(_operator_ids))
    AND (_channel      IS NULL OR 'voice' = ANY(_channel))
),
msgs AS (
  SELECT DISTINCT cl.cpf, cl.credor, m.direction FROM chat_messages m
  JOIN conversations conv ON conv.id = m.conversation_id AND conv.tenant_id = _tenant_id
  JOIN clients cl ON cl.id = conv.client_id AND cl.tenant_id = _tenant_id
  WHERE m.tenant_id = _tenant_id
    AND m.created_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor  IS NULL OR cl.credor         = ANY(_credor))
    AND (_channel IS NULL OR conv.channel_type = ANY(_channel))
),
sessions AS (
  SELECT DISTINCT s.client_cpf AS cpf, s.credor FROM atendimento_sessions s
  WHERE s.tenant_id = _tenant_id
    AND s.opened_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor       IS NULL OR s.credor          = ANY(_credor))
    AND (_channel      IS NULL OR s.current_channel = ANY(_channel))
    AND (_operator_ids IS NULL OR s.assigned_to     = ANY(_operator_ids))
),
agr AS (
  SELECT DISTINCT a.client_cpf AS cpf, a.credor, a.status FROM agreements a
  WHERE a.tenant_id = _tenant_id
    AND a.created_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND a.status <> 'rejected'
    AND (_credor       IS NULL OR a.credor     = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
),
pays AS (
  SELECT DISTINCT a.client_cpf AS cpf, a.credor FROM (
    SELECT mp.agreement_id FROM manual_payments mp
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
      AND mp.payment_date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    UNION
    SELECT pp.agreement_id FROM portal_payments pp
    WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
      AND pp.updated_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    UNION
    SELECT nc.agreement_id FROM negociarie_cobrancas nc
    WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago'
      AND nc.data_pagamento BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
  ) px
  JOIN agreements a ON a.id = px.agreement_id AND a.tenant_id = _tenant_id
  WHERE (_credor       IS NULL OR a.credor     = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
),
base_raw AS (
  SELECT cpf, credor FROM calls
  UNION SELECT cpf, credor FROM msgs
  UNION SELECT cpf, credor FROM sessions
  UNION SELECT cpf, credor FROM agr
),
base AS (
  SELECT DISTINCT b.cpf, b.credor FROM base_raw b
  LEFT JOIN client_score s ON s.cpf = b.cpf AND s.credor = b.credor
  WHERE b.cpf IS NOT NULL AND b.credor IS NOT NULL
    AND (_score_min IS NULL OR COALESCE(s.propensity_score, 0)   >= _score_min)
    AND (_score_max IS NULL OR COALESCE(s.propensity_score, 100) <= _score_max)
),
contato AS (
  SELECT DISTINCT b.cpf, b.credor FROM base b
  WHERE EXISTS (SELECT 1 FROM calls c WHERE c.cpf=b.cpf AND c.credor=b.credor
                  AND lower(coalesce(c.status,'')) IN ('answered','cpc','connected','completed','atendida'))
     OR EXISTS (SELECT 1 FROM msgs m WHERE m.cpf=b.cpf AND m.credor=b.credor AND m.direction='inbound')
),
negociacao AS (
  SELECT DISTINCT b.cpf, b.credor FROM base b
  WHERE EXISTS (SELECT 1 FROM sessions s WHERE s.cpf=b.cpf AND s.credor=b.credor)
     OR EXISTS (SELECT 1 FROM agr a WHERE a.cpf=b.cpf AND a.credor=b.credor)
),
acordo AS (
  SELECT DISTINCT b.cpf, b.credor FROM base b
  WHERE EXISTS (SELECT 1 FROM agr a WHERE a.cpf=b.cpf AND a.credor=b.credor)
),
pagamento AS (
  SELECT DISTINCT b.cpf, b.credor FROM base b
  WHERE EXISTS (SELECT 1 FROM pays p WHERE p.cpf=b.cpf AND p.credor=b.credor)
),
per_credor AS (
  SELECT b.credor,
    COUNT(*)::int AS qtd_base,
    COUNT(*) FILTER (WHERE (b.cpf,b.credor) IN (SELECT cpf,credor FROM contato))::int    AS qtd_contato,
    COUNT(*) FILTER (WHERE (b.cpf,b.credor) IN (SELECT cpf,credor FROM negociacao))::int AS qtd_neg,
    COUNT(*) FILTER (WHERE (b.cpf,b.credor) IN (SELECT cpf,credor FROM acordo))::int     AS qtd_acordo,
    COUNT(*) FILTER (WHERE (b.cpf,b.credor) IN (SELECT cpf,credor FROM pagamento))::int  AS qtd_pag
  FROM base b GROUP BY b.credor
),
expanded AS (
  SELECT credor, 'base_ativa_periodo'::text AS stage, 1 AS ord, qtd_base   AS qtd, NULL::int AS prev_qtd FROM per_credor
  UNION ALL SELECT credor, 'contato_efetivo', 2, qtd_contato, qtd_base    FROM per_credor
  UNION ALL SELECT credor, 'negociacao',      3, qtd_neg,     qtd_contato FROM per_credor
  UNION ALL SELECT credor, 'acordo',          4, qtd_acordo,  qtd_neg     FROM per_credor
  UNION ALL SELECT credor, 'pagamento',       5, qtd_pag,     qtd_acordo  FROM per_credor
)
SELECT credor, stage, qtd,
  CASE WHEN prev_qtd IS NULL OR prev_qtd = 0 THEN NULL
       ELSE ROUND(GREATEST(0, LEAST(100, (1 - qtd::numeric / prev_qtd) * 100)), 2)
  END AS dropoff_pct
FROM expanded ORDER BY credor, ord;
$function$;

-- 6) get_bi_operator_performance — total_recebido from 3 sources by payment date
CREATE OR REPLACE FUNCTION public.get_bi_operator_performance(_tenant_id uuid, _date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date, _credor text[] DEFAULT NULL::text[], _operator_ids uuid[] DEFAULT NULL::uuid[], _channel text[] DEFAULT NULL::text[], _score_min integer DEFAULT NULL::integer, _score_max integer DEFAULT NULL::integer)
RETURNS TABLE(operator_id uuid, operator_name text, qtd_acordos integer, total_recebido numeric, qtd_calls integer, qtd_cpc integer, taxa_cpc numeric, qtd_quebras integer, taxa_quebra numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH ag AS (
    SELECT a.id, a.created_by, a.proposed_total, a.status FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  pagos AS (
    SELECT p.agreement_id, SUM(p.pago)::numeric AS pago FROM (
      SELECT mp.amount_paid::numeric AS pago, mp.agreement_id FROM manual_payments mp
      WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
        AND (_date_from IS NULL OR mp.payment_date >= _date_from)
        AND (_date_to   IS NULL OR mp.payment_date <= _date_to)
      UNION ALL
      SELECT pp.amount::numeric, pp.agreement_id FROM portal_payments pp
      WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
        AND (_date_from IS NULL OR pp.updated_at::date >= _date_from)
        AND (_date_to   IS NULL OR pp.updated_at::date <= _date_to)
      UNION ALL
      SELECT nc.valor_pago::numeric, nc.agreement_id FROM negociarie_cobrancas nc
      WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago' AND nc.data_pagamento IS NOT NULL
        AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
        AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
    ) p WHERE p.agreement_id IS NOT NULL
    GROUP BY p.agreement_id
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
$function$;

-- 7) get_bi_channel_performance — total_recebido_atribuido from 3 sources
CREATE OR REPLACE FUNCTION public.get_bi_channel_performance(_tenant_id uuid, _date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date, _credor text[] DEFAULT NULL::text[], _operator_ids uuid[] DEFAULT NULL::uuid[], _channel text[] DEFAULT NULL::text[], _score_min integer DEFAULT NULL::integer, _score_max integer DEFAULT NULL::integer)
RETURNS TABLE(channel text, qtd_interacoes integer, qtd_clientes_unicos integer, qtd_acordos_atribuidos integer, taxa_conversao numeric, total_recebido_atribuido numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    SELECT p.agreement_id, SUM(p.pago)::numeric AS pago FROM (
      SELECT mp.amount_paid::numeric AS pago, mp.agreement_id FROM manual_payments mp
      WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
        AND (_date_from IS NULL OR mp.payment_date >= _date_from)
        AND (_date_to   IS NULL OR mp.payment_date <= _date_to)
      UNION ALL
      SELECT pp.amount::numeric, pp.agreement_id FROM portal_payments pp
      WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
        AND (_date_from IS NULL OR pp.updated_at::date >= _date_from)
        AND (_date_to   IS NULL OR pp.updated_at::date <= _date_to)
      UNION ALL
      SELECT nc.valor_pago::numeric, nc.agreement_id FROM negociarie_cobrancas nc
      WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago' AND nc.data_pagamento IS NOT NULL
        AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
        AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
    ) p WHERE p.agreement_id IS NOT NULL
    GROUP BY p.agreement_id
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
$function$;

-- 8) get_bi_score_vs_result — pag CTE from 3 sources by payment date
CREATE OR REPLACE FUNCTION public.get_bi_score_vs_result(_tenant_id uuid, _date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date, _credor text[] DEFAULT NULL::text[], _operator_ids uuid[] DEFAULT NULL::uuid[], _channel text[] DEFAULT NULL::text[], _score_min integer DEFAULT NULL::integer, _score_max integer DEFAULT NULL::integer)
RETURNS TABLE(bucket text, qtd_clientes integer, qtd_com_acordo integer, taxa_acordo numeric, qtd_pagos integer, taxa_pagamento numeric, valor_recebido numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    SELECT a.client_cpf, a.credor, SUM(p.pago)::numeric AS pago FROM (
      SELECT mp.amount_paid::numeric AS pago, mp.agreement_id FROM manual_payments mp
      WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
        AND (_date_from IS NULL OR mp.payment_date >= _date_from)
        AND (_date_to   IS NULL OR mp.payment_date <= _date_to)
      UNION ALL
      SELECT pp.amount::numeric, pp.agreement_id FROM portal_payments pp
      WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
        AND (_date_from IS NULL OR pp.updated_at::date >= _date_from)
        AND (_date_to   IS NULL OR pp.updated_at::date <= _date_to)
      UNION ALL
      SELECT nc.valor_pago::numeric, nc.agreement_id FROM negociarie_cobrancas nc
      WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago' AND nc.data_pagamento IS NOT NULL
        AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
        AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
    ) p
    JOIN agreements a ON a.id = p.agreement_id AND a.tenant_id = _tenant_id
    WHERE (_credor       IS NULL OR a.credor = ANY(_credor))
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
$function$;

-- 9) get_bi_score_distribution — dedup by (cpf, credor)
CREATE OR REPLACE FUNCTION public.get_bi_score_distribution(_tenant_id uuid, _date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date, _credor text[] DEFAULT NULL::text[], _operator_ids uuid[] DEFAULT NULL::uuid[], _channel text[] DEFAULT NULL::text[], _score_min integer DEFAULT NULL::integer, _score_max integer DEFAULT NULL::integer)
RETURNS TABLE(bucket text, qtd integer, pct numeric, valor_carteira numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT DISTINCT ON (c.cpf, c.credor)
      c.propensity_score, COALESCE(c.valor_atualizado, c.valor_parcela, 0) AS val
    FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_credor    IS NULL OR c.credor = ANY(_credor))
      AND (_score_min IS NULL OR c.propensity_score >= _score_min)
      AND (_score_max IS NULL OR c.propensity_score <= _score_max)
    ORDER BY c.cpf, c.credor, c.created_at DESC
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
$function$;
