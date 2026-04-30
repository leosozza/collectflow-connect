-- ============================================================
-- ANALYTICS — Fase 7 (correções residuais)
-- Tudo CREATE OR REPLACE — sem DROP, sem alterar schema, sem DML.
-- Preserva integralmente a lógica de negócio das versões anteriores.
-- ============================================================

-- ----------------------------------------------------------------
-- 7.1 — Guard tolerante a Super Admin global (via profiles.role)
--       Recria as 4 RPCs alteradas em 20260430163427 mudando APENAS
--       o bloco IF NOT (...). Resto idêntico à versão anterior.
-- ----------------------------------------------------------------

-- 7.1.a get_bi_channel_performance
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
  IF NOT (
       public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.user_id = auth.uid() AND p.role::text = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.tenant_users tu
               WHERE tu.tenant_id = _tenant_id AND tu.user_id = auth.uid())
  ) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  RETURN QUERY
  WITH
  ev_raw AS (
    SELECT
      ce.client_cpf,
      ce.created_at,
      CASE
        WHEN ce.event_type IN (
          'whatsapp_inbound','whatsapp_outbound','message_sent','message_deleted',
          'atendimento_opened','conversation_auto_closed'
        ) THEN 'whatsapp'
        WHEN ce.event_type IN ('disposition','call_hangup') THEN 'voice'
        ELSE NULL
      END AS channel
    FROM public.client_events ce
    WHERE ce.tenant_id = _tenant_id
      AND ce.event_type IN (
        'whatsapp_inbound','whatsapp_outbound','message_sent','message_deleted',
        'atendimento_opened','conversation_auto_closed',
        'disposition','call_hangup'
      )
      AND (_date_from IS NULL OR ce.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR ce.created_at::date <= _date_to)
  ),
  ev AS (
    SELECT * FROM ev_raw
    WHERE channel IS NOT NULL
      AND (_channel IS NULL OR channel = ANY(_channel))
  ),
  inter AS (
    SELECT channel,
           COUNT(*)::int AS qtd_interacoes,
           COUNT(DISTINCT client_cpf)::int AS qtd_unicos
    FROM ev GROUP BY channel
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
  pagos AS (
    SELECT p.agreement_id, SUM(p.pago)::numeric AS pago FROM (
      SELECT mp.amount_paid::numeric AS pago, mp.agreement_id
        FROM public.manual_payments mp
       WHERE mp.tenant_id = _tenant_id
         AND mp.status IN ('confirmed','approved')
         AND (_date_from IS NULL OR mp.payment_date >= _date_from)
         AND (_date_to   IS NULL OR mp.payment_date <= _date_to)
      UNION ALL
      SELECT pp.amount::numeric, pp.agreement_id
        FROM public.portal_payments pp
       WHERE pp.tenant_id = _tenant_id
         AND pp.status = 'paid'
         AND (_date_from IS NULL OR pp.updated_at::date >= _date_from)
         AND (_date_to   IS NULL OR pp.updated_at::date <= _date_to)
      UNION ALL
      SELECT nc.valor_pago::numeric, nc.agreement_id
        FROM public.negociarie_cobrancas nc
       WHERE nc.tenant_id = _tenant_id
         AND nc.status = 'pago'
         AND nc.data_pagamento IS NOT NULL
         AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
         AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
    ) p
    WHERE p.agreement_id IS NOT NULL
    GROUP BY p.agreement_id
  ),
  ag_ch AS (
    SELECT aa.channel,
           COUNT(*)::int AS qtd_acordos,
           COALESCE(SUM(p.pago),0)::numeric AS total_recebido
    FROM ag_attr aa
    LEFT JOIN pagos p ON p.agreement_id = aa.id
    WHERE aa.channel IS NOT NULL
      AND (_channel IS NULL OR aa.channel = ANY(_channel))
    GROUP BY aa.channel
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
    COALESCE(ac.total_recebido, 0)::numeric
  FROM inter i
  LEFT JOIN ag_ch ac ON ac.channel = i.channel
  ORDER BY i.qtd_interacoes DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_bi_channel_performance(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 7.1.b get_bi_breakage_analysis
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
  IF NOT (
       public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.user_id = auth.uid() AND p.role::text = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.tenant_users tu
               WHERE tu.tenant_id = _tenant_id AND tu.user_id = auth.uid())
  ) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

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
$$;

GRANT EXECUTE ON FUNCTION public.get_bi_breakage_analysis(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- 7.1.c get_bi_breakage_by_operator
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
  IF NOT (
       public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.user_id = auth.uid() AND p.role::text = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.tenant_users tu
               WHERE tu.tenant_id = _tenant_id AND tu.user_id = auth.uid())
  ) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

  RETURN QUERY
  WITH
  ag_total AS (
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
      AND (_date_from IS NULL OR a.updated_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.updated_at::date <= _date_to)
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


-- 7.1.d get_bi_recurrence_analysis
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
  IF NOT (
       public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.user_id = auth.uid() AND p.role::text = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.tenant_users tu
               WHERE tu.tenant_id = _tenant_id AND tu.user_id = auth.uid())
  ) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

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


-- ----------------------------------------------------------------
-- 7.2 — get_bi_response_time_by_channel: clip outliers (gap <= 4h)
-- Mantém assinatura, retorno e nomes. Adiciona filtro resp_s <= 14400.
-- ----------------------------------------------------------------
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH msgs AS (
    SELECT m.conversation_id, m.direction, m.created_at,
           COALESCE(c.channel_type, m.provider, 'whatsapp') AS channel
    FROM chat_messages m
    LEFT JOIN conversations c ON c.id = m.conversation_id AND c.tenant_id = _tenant_id
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
  -- Clip a 4h: gaps maiores são considerados fora de janela operacional
  -- (ex.: cliente respondeu no dia seguinte) e não devem distorcer a média.
  SELECT channel,
    ROUND(AVG(resp_s)::numeric, 2),
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY resp_s)::numeric, 2),
    ROUND(percentile_cont(0.9) WITHIN GROUP (ORDER BY resp_s)::numeric, 2),
    COUNT(*)::int
  FROM pairs
  WHERE resp_s >= 0 AND resp_s <= 14400
  GROUP BY channel
  ORDER BY 2;
$$;

GRANT EXECUTE ON FUNCTION public.get_bi_response_time_by_channel(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


-- ----------------------------------------------------------------
-- 7.3 — get_distinct_credores: lookup sem limite de 1000 do PostgREST
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_distinct_credores(_tenant_id uuid)
RETURNS TABLE(credor text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF NOT (
       public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.user_id = auth.uid() AND p.role::text = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.tenant_users tu
               WHERE tu.tenant_id = _tenant_id AND tu.user_id = auth.uid())
  ) THEN RAISE EXCEPTION 'forbidden tenant'; END IF;

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