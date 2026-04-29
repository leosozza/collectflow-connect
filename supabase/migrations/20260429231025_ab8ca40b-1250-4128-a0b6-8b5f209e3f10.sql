
CREATE OR REPLACE FUNCTION public.get_bi_collection_funnel(
  _tenant_id     uuid,
  _date_from     date    DEFAULT NULL,
  _date_to       date    DEFAULT NULL,
  _credor        text[]  DEFAULT NULL,
  _operator_ids  uuid[]  DEFAULT NULL,
  _channel       text[]  DEFAULT NULL,
  _score_min     integer DEFAULT NULL,
  _score_max     integer DEFAULT NULL
)
RETURNS TABLE (
  stage          text,
  stage_order    integer,
  qtd            integer,
  conversao_pct  numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH params AS (
  SELECT
    COALESCE(_date_from, (CURRENT_DATE - INTERVAL '30 days')::date) AS dfrom,
    COALESCE(_date_to,   CURRENT_DATE)                              AS dto
),
client_score AS (
  SELECT DISTINCT ON (c.cpf, c.credor)
    c.cpf, c.credor, c.propensity_score
  FROM clients c
  WHERE c.tenant_id = _tenant_id
  ORDER BY c.cpf, c.credor, c.created_at DESC
),
calls AS (
  SELECT DISTINCT cl.cpf, cl.credor, cal.status
  FROM call_logs cal
  JOIN clients cl ON cl.tenant_id = cal.tenant_id AND cl.cpf = cal.client_cpf
  WHERE cal.tenant_id = _tenant_id
    AND cal.called_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor       IS NULL OR cl.credor          = ANY(_credor))
    AND (_operator_ids IS NULL OR cal.operator_id::uuid = ANY(_operator_ids))
    AND (_channel      IS NULL OR 'voice' = ANY(_channel))
),
msgs AS (
  SELECT DISTINCT cl.cpf, cl.credor, m.direction
  FROM chat_messages m
  JOIN conversations conv ON conv.id = m.conversation_id AND conv.tenant_id = _tenant_id
  JOIN clients cl ON cl.id = conv.client_id AND cl.tenant_id = _tenant_id
  WHERE m.tenant_id = _tenant_id
    AND m.created_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor  IS NULL OR cl.credor         = ANY(_credor))
    AND (_channel IS NULL OR conv.channel_type = ANY(_channel))
),
sessions AS (
  SELECT DISTINCT s.client_cpf AS cpf, s.credor
  FROM atendimento_sessions s
  WHERE s.tenant_id = _tenant_id
    AND s.opened_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor       IS NULL OR s.credor          = ANY(_credor))
    AND (_channel      IS NULL OR s.current_channel = ANY(_channel))
    AND (_operator_ids IS NULL OR s.assigned_to     = ANY(_operator_ids))
),
agr AS (
  SELECT DISTINCT a.client_cpf AS cpf, a.credor, a.status
  FROM agreements a
  WHERE a.tenant_id = _tenant_id
    AND a.created_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND a.status <> 'rejected'
    AND (_credor       IS NULL OR a.credor     = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
),
pays AS (
  SELECT DISTINCT a.client_cpf AS cpf, a.credor
  FROM manual_payments mp
  JOIN agreements a ON a.id = mp.agreement_id AND a.tenant_id = _tenant_id
  WHERE mp.tenant_id = _tenant_id
    AND mp.status IN ('confirmed','approved')
    AND mp.payment_date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor       IS NULL OR a.credor     = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
),
base_raw AS (
  SELECT cpf, credor FROM calls
  UNION SELECT cpf, credor FROM msgs
  UNION SELECT cpf, credor FROM sessions
  UNION SELECT cpf, credor FROM agr
),
base AS (
  SELECT DISTINCT b.cpf, b.credor
  FROM base_raw b
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
       CASE WHEN qtd_base > 0 THEN ROUND(LEAST(qtd_contato::numeric / qtd_base * 100, 100), 2) ELSE 0 END
FROM counts
UNION ALL
SELECT 'negociacao', 3, qtd_negociacao,
       CASE WHEN qtd_base > 0 THEN ROUND(LEAST(qtd_negociacao::numeric / qtd_base * 100, 100), 2) ELSE 0 END
FROM counts
UNION ALL
SELECT 'acordo', 4, qtd_acordo,
       CASE WHEN qtd_base > 0 THEN ROUND(LEAST(qtd_acordo::numeric / qtd_base * 100, 100), 2) ELSE 0 END
FROM counts
UNION ALL
SELECT 'pagamento', 5, qtd_pagamento,
       CASE WHEN qtd_base > 0 THEN ROUND(LEAST(qtd_pagamento::numeric / qtd_base * 100, 100), 2) ELSE 0 END
FROM counts
ORDER BY 2;
$$;

GRANT EXECUTE ON FUNCTION public.get_bi_collection_funnel(uuid, date, date, text[], uuid[], text[], integer, integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_funnel_dropoff(
  _tenant_id     uuid,
  _date_from     date    DEFAULT NULL,
  _date_to       date    DEFAULT NULL,
  _credor        text[]  DEFAULT NULL,
  _operator_ids  uuid[]  DEFAULT NULL,
  _channel       text[]  DEFAULT NULL,
  _score_min     integer DEFAULT NULL,
  _score_max     integer DEFAULT NULL
)
RETURNS TABLE (
  credor       text,
  stage        text,
  qtd          integer,
  dropoff_pct  numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH params AS (
  SELECT
    COALESCE(_date_from, (CURRENT_DATE - INTERVAL '30 days')::date) AS dfrom,
    COALESCE(_date_to,   CURRENT_DATE)                              AS dto
),
client_score AS (
  SELECT DISTINCT ON (c.cpf, c.credor)
    c.cpf, c.credor, c.propensity_score
  FROM clients c
  WHERE c.tenant_id = _tenant_id
  ORDER BY c.cpf, c.credor, c.created_at DESC
),
calls AS (
  SELECT DISTINCT cl.cpf, cl.credor, cal.status
  FROM call_logs cal
  JOIN clients cl ON cl.tenant_id = cal.tenant_id AND cl.cpf = cal.client_cpf
  WHERE cal.tenant_id = _tenant_id
    AND cal.called_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor       IS NULL OR cl.credor          = ANY(_credor))
    AND (_operator_ids IS NULL OR cal.operator_id::uuid = ANY(_operator_ids))
    AND (_channel      IS NULL OR 'voice' = ANY(_channel))
),
msgs AS (
  SELECT DISTINCT cl.cpf, cl.credor, m.direction
  FROM chat_messages m
  JOIN conversations conv ON conv.id = m.conversation_id AND conv.tenant_id = _tenant_id
  JOIN clients cl ON cl.id = conv.client_id AND cl.tenant_id = _tenant_id
  WHERE m.tenant_id = _tenant_id
    AND m.created_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor  IS NULL OR cl.credor         = ANY(_credor))
    AND (_channel IS NULL OR conv.channel_type = ANY(_channel))
),
sessions AS (
  SELECT DISTINCT s.client_cpf AS cpf, s.credor
  FROM atendimento_sessions s
  WHERE s.tenant_id = _tenant_id
    AND s.opened_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor       IS NULL OR s.credor          = ANY(_credor))
    AND (_channel      IS NULL OR s.current_channel = ANY(_channel))
    AND (_operator_ids IS NULL OR s.assigned_to     = ANY(_operator_ids))
),
agr AS (
  SELECT DISTINCT a.client_cpf AS cpf, a.credor, a.status
  FROM agreements a
  WHERE a.tenant_id = _tenant_id
    AND a.created_at::date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND a.status <> 'rejected'
    AND (_credor       IS NULL OR a.credor     = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
),
pays AS (
  SELECT DISTINCT a.client_cpf AS cpf, a.credor
  FROM manual_payments mp
  JOIN agreements a ON a.id = mp.agreement_id AND a.tenant_id = _tenant_id
  WHERE mp.tenant_id = _tenant_id
    AND mp.status IN ('confirmed','approved')
    AND mp.payment_date BETWEEN (SELECT dfrom FROM params) AND (SELECT dto FROM params)
    AND (_credor       IS NULL OR a.credor     = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
),
base_raw AS (
  SELECT cpf, credor FROM calls
  UNION SELECT cpf, credor FROM msgs
  UNION SELECT cpf, credor FROM sessions
  UNION SELECT cpf, credor FROM agr
),
base AS (
  SELECT DISTINCT b.cpf, b.credor
  FROM base_raw b
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
  FROM base b
  GROUP BY b.credor
),
expanded AS (
  SELECT credor, 'base_ativa_periodo'::text AS stage, 1 AS ord, qtd_base   AS qtd, NULL::int AS prev_qtd FROM per_credor
  UNION ALL SELECT credor, 'contato_efetivo', 2, qtd_contato, qtd_base    FROM per_credor
  UNION ALL SELECT credor, 'negociacao',      3, qtd_neg,     qtd_contato FROM per_credor
  UNION ALL SELECT credor, 'acordo',          4, qtd_acordo,  qtd_neg     FROM per_credor
  UNION ALL SELECT credor, 'pagamento',       5, qtd_pag,     qtd_acordo  FROM per_credor
)
SELECT credor, stage, qtd,
  CASE
    WHEN prev_qtd IS NULL OR prev_qtd = 0 THEN NULL
    ELSE ROUND(GREATEST(0, LEAST(100, (1 - qtd::numeric / prev_qtd) * 100)), 2)
  END AS dropoff_pct
FROM expanded
ORDER BY credor, ord;
$$;

GRANT EXECUTE ON FUNCTION public.get_bi_funnel_dropoff(uuid, date, date, text[], uuid[], text[], integer, integer) TO authenticated;
