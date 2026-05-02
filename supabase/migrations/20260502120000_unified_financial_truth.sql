-- =====================================================================
-- Fonte financeira central do RIVO
-- - Somente leitura/calculo: sem DML, sem DROP de tabelas e sem reescrita
--   de dados historicos.
-- - Gateways/bancos/arquivos sao origens. A verdade operacional e o
--   pagamento confirmado normalizado por tenant/acordo/parcela.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.resolve_financial_tenant(_tenant_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF _tenant_id IS NOT NULL THEN
    IF NOT public.can_access_tenant(_tenant_id) THEN
      RAISE EXCEPTION 'forbidden tenant';
    END IF;
    RETURN _tenant_id;
  END IF;

  SELECT tu.tenant_id
    INTO v_tenant_id
  FROM public.tenant_users tu
  WHERE tu.user_id = auth.uid()
  ORDER BY tu.created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NOT NULL AND public.can_access_tenant(v_tenant_id) THEN
    RETURN v_tenant_id;
  END IF;

  RETURN NULL;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_financial_tenant(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_financial_confirmed_payments(
  _tenant_id uuid,
  _date_from date DEFAULT NULL::date,
  _date_to date DEFAULT NULL::date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[],
  _source text[] DEFAULT NULL::text[],
  _agreement_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  source text,
  source_id text,
  tenant_id uuid,
  agreement_id uuid,
  client_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  operator_id uuid,
  installment_key text,
  installment_number integer,
  amount_paid numeric,
  paid_at date,
  paid_at_ts timestamptz,
  payment_method text,
  external_id text,
  raw_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.resolve_financial_tenant(_tenant_id);
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH unified AS (
    SELECT
      'manual'::text AS source,
      mp.id::text AS source_id,
      mp.tenant_id,
      mp.agreement_id,
      NULL::uuid AS client_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      a.created_by AS operator_id,
      mp.installment_key,
      mp.installment_number::integer,
      COALESCE(mp.amount_paid, 0)::numeric AS amount_paid,
      mp.payment_date::date AS paid_at,
      mp.payment_date::timestamptz AS paid_at_ts,
      mp.payment_method::text AS payment_method,
      mp.id::text AS external_id,
      mp.status::text AS raw_status
    FROM public.manual_payments mp
    JOIN public.agreements a
      ON a.id = mp.agreement_id
     AND a.tenant_id = mp.tenant_id
    WHERE mp.tenant_id = v_tenant_id
      AND mp.status IN ('confirmed', 'approved')
      AND mp.payment_date IS NOT NULL

    UNION ALL

    SELECT
      'portal'::text AS source,
      pp.id::text AS source_id,
      pp.tenant_id,
      pp.agreement_id,
      NULL::uuid AS client_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      a.created_by AS operator_id,
      NULL::text AS installment_key,
      NULL::integer AS installment_number,
      COALESCE(pp.amount, 0)::numeric AS amount_paid,
      pp.updated_at::date AS paid_at,
      pp.updated_at::timestamptz AS paid_at_ts,
      pp.payment_method::text AS payment_method,
      pp.negociarie_id_geral::text AS external_id,
      pp.status::text AS raw_status
    FROM public.portal_payments pp
    JOIN public.agreements a
      ON a.id = pp.agreement_id
     AND a.tenant_id = pp.tenant_id
    WHERE pp.tenant_id = v_tenant_id
      AND pp.status = 'paid'
      AND pp.updated_at IS NOT NULL

    UNION ALL

    SELECT
      'negociarie'::text AS source,
      nc.id::text AS source_id,
      nc.tenant_id,
      nc.agreement_id,
      nc.client_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      a.created_by AS operator_id,
      nc.installment_key,
      NULL::integer AS installment_number,
      COALESCE(nc.valor_pago, nc.valor, 0)::numeric AS amount_paid,
      nc.data_pagamento::date AS paid_at,
      COALESCE(nc.data_pagamento::timestamptz, nc.updated_at::timestamptz) AS paid_at_ts,
      nc.tipo::text AS payment_method,
      COALESCE(nc.id_geral, nc.id_parcela, nc.id::text)::text AS external_id,
      nc.status::text AS raw_status
    FROM public.negociarie_cobrancas nc
    JOIN public.agreements a
      ON a.id = nc.agreement_id
     AND a.tenant_id = nc.tenant_id
    WHERE nc.tenant_id = v_tenant_id
      AND nc.status = 'pago'
      AND nc.agreement_id IS NOT NULL
      AND nc.data_pagamento IS NOT NULL
  )
  SELECT
    u.source,
    u.source_id,
    u.tenant_id,
    u.agreement_id,
    u.client_id,
    u.client_cpf,
    u.client_name,
    u.credor,
    u.operator_id,
    u.installment_key,
    u.installment_number,
    u.amount_paid,
    u.paid_at,
    u.paid_at_ts,
    u.payment_method,
    u.external_id,
    u.raw_status
  FROM unified u
  WHERE (_date_from IS NULL OR u.paid_at >= _date_from)
    AND (_date_to IS NULL OR u.paid_at <= _date_to)
    AND (_credor IS NULL OR u.credor = ANY(_credor))
    AND (_operator_ids IS NULL OR u.operator_id = ANY(_operator_ids))
    AND (_source IS NULL OR u.source = ANY(_source))
    AND (_agreement_id IS NULL OR u.agreement_id = _agreement_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_financial_confirmed_payments(uuid,date,date,text[],uuid[],text[],uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_financial_received_by_day(
  _tenant_id uuid,
  _date_from date,
  _date_to date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(payment_date date, total_recebido numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.paid_at AS payment_date, COALESCE(SUM(p.amount_paid), 0)::numeric AS total_recebido
  FROM public.get_financial_confirmed_payments(
    _tenant_id,
    _date_from,
    _date_to,
    _credor,
    _operator_ids,
    NULL::text[],
    NULL::uuid
  ) p
  GROUP BY p.paid_at
  ORDER BY p.paid_at;
$function$;

GRANT EXECUTE ON FUNCTION public.get_financial_received_by_day(uuid,date,date,text[],uuid[]) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_financial_agreement_installments(
  _tenant_id uuid,
  _date_from date DEFAULT NULL::date,
  _date_to date DEFAULT NULL::date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[],
  _agreement_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  tenant_id uuid,
  agreement_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  operator_id uuid,
  agreement_status text,
  cancellation_type text,
  agreement_created_at timestamptz,
  agreement_updated_at timestamptz,
  installment_key text,
  installment_number integer,
  display_number integer,
  total_installments integer,
  due_date date,
  installment_amount numeric,
  paid_amount numeric,
  effective_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.resolve_financial_tenant(_tenant_id);
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH schedule_all AS (
    SELECT
      a.tenant_id,
      a.id AS agreement_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      a.created_by AS operator_id,
      a.status AS agreement_status,
      a.cancellation_type,
      a.created_at AS agreement_created_at,
      a.updated_at AS agreement_updated_at,
      'entrada'::text AS installment_key,
      0::integer AS installment_number,
      1::integer AS display_number,
      (COALESCE(a.new_installments, 0) + 1)::integer AS total_installments,
      COALESCE(
        (a.custom_installment_dates->>'entrada')::date,
        a.entrada_date,
        a.first_due_date
      )::date AS due_date,
      COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value, 0)::numeric AS installment_amount,
      0::integer AS sort_order
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND COALESCE(a.entrada_value, 0) > 0
      AND NOT (COALESCE(a.cancelled_installments, '{}'::jsonb) ? 'entrada')
      AND (_agreement_id IS NULL OR a.id = _agreement_id)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))

    UNION ALL

    SELECT
      a.tenant_id,
      a.id AS agreement_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      a.created_by AS operator_id,
      a.status AS agreement_status,
      a.cancellation_type,
      a.created_at AS agreement_created_at,
      a.updated_at AS agreement_updated_at,
      gs.i::text AS installment_key,
      gs.i::integer AS installment_number,
      (gs.i + CASE WHEN COALESCE(a.entrada_value, 0) > 0 THEN 1 ELSE 0 END)::integer AS display_number,
      (COALESCE(a.new_installments, 0) + CASE WHEN COALESCE(a.entrada_value, 0) > 0 THEN 1 ELSE 0 END)::integer AS total_installments,
      COALESCE(
        (a.custom_installment_dates->>gs.i::text)::date,
        (a.first_due_date::date + ((gs.i - 1) * interval '1 month'))::date
      )::date AS due_date,
      COALESCE((a.custom_installment_values->>gs.i::text)::numeric, a.new_installment_value, 0)::numeric AS installment_amount,
      gs.i::integer AS sort_order
    FROM public.agreements a
    CROSS JOIN LATERAL generate_series(1, COALESCE(a.new_installments, 0)) AS gs(i)
    WHERE a.tenant_id = v_tenant_id
      AND NOT (COALESCE(a.cancelled_installments, '{}'::jsonb) ? gs.i::text)
      AND (_agreement_id IS NULL OR a.id = _agreement_id)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  paid AS (
    SELECT *
    FROM public.get_financial_confirmed_payments(
      v_tenant_id,
      NULL::date,
      NULL::date,
      _credor,
      _operator_ids,
      NULL::text[],
      _agreement_id
    )
  ),
  with_keyed AS (
    SELECT
      s.*,
      COALESCE((
        SELECT SUM(p.amount_paid)
        FROM paid p
        WHERE p.agreement_id = s.agreement_id
          AND (
            (
              s.installment_number = 0
              AND (
                p.installment_key IN ('entrada', s.agreement_id::text || ':0')
                OR p.installment_number = 0
              )
            )
            OR (
              s.installment_number > 0
              AND (
                p.installment_key IN (s.installment_key, s.agreement_id::text || ':' || s.installment_key)
                OR p.installment_number IN (s.installment_number, s.display_number)
              )
            )
          )
      ), 0)::numeric AS keyed_paid_amount,
      COALESCE((
        SELECT SUM(p.amount_paid)
        FROM paid p
        WHERE p.agreement_id = s.agreement_id
          AND p.installment_key IS NULL
          AND p.installment_number IS NULL
      ), 0)::numeric AS unkeyed_paid_total
    FROM schedule_all s
  ),
  with_open AS (
    SELECT
      wk.*,
      GREATEST(wk.installment_amount - wk.keyed_paid_amount, 0)::numeric AS open_after_keyed
    FROM with_keyed wk
  ),
  balanced AS (
    SELECT
      wo.*,
      COALESCE(
        SUM(wo.open_after_keyed) OVER (
          PARTITION BY wo.agreement_id
          ORDER BY wo.due_date, wo.sort_order
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
        0
      )::numeric AS open_before
    FROM with_open wo
  ),
  final_rows AS (
    SELECT
      b.*,
      LEAST(
        b.installment_amount,
        b.keyed_paid_amount + GREATEST(LEAST(b.unkeyed_paid_total - b.open_before, b.open_after_keyed), 0)
      )::numeric AS computed_paid_amount
    FROM balanced b
  )
  SELECT
    fr.tenant_id,
    fr.agreement_id,
    fr.client_cpf,
    fr.client_name,
    fr.credor,
    fr.operator_id,
    fr.agreement_status,
    fr.cancellation_type,
    fr.agreement_created_at,
    fr.agreement_updated_at,
    fr.installment_key,
    fr.installment_number,
    fr.display_number,
    fr.total_installments,
    fr.due_date,
    fr.installment_amount,
    fr.computed_paid_amount AS paid_amount,
    CASE
      WHEN fr.computed_paid_amount >= fr.installment_amount - 0.01 THEN 'paid'
      WHEN fr.agreement_status = 'cancelled' THEN 'cancelled'
      WHEN fr.due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END::text AS effective_status
  FROM final_rows fr
  WHERE (_date_from IS NULL OR fr.due_date >= _date_from)
    AND (_date_to IS NULL OR fr.due_date <= _date_to)
  ORDER BY fr.due_date, fr.client_name, fr.display_number;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_financial_agreement_installments(uuid,date,date,text[],uuid[],uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_financial_summary(
  _tenant_id uuid,
  _date_from date DEFAULT NULL::date,
  _date_to date DEFAULT NULL::date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  total_negociado numeric,
  total_recebido numeric,
  total_pendente numeric,
  total_quebra numeric,
  qtd_acordos integer,
  qtd_acordos_ativos integer,
  qtd_quebras integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.resolve_financial_tenant(_tenant_id);
  IF v_tenant_id IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::integer, 0::integer, 0::integer;
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT a.id, a.proposed_total, a.status
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to IS NULL OR a.created_at::date <= _date_to)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  received AS (
    SELECT COALESCE(SUM(p.amount_paid), 0)::numeric AS total
    FROM public.get_financial_confirmed_payments(
      v_tenant_id,
      _date_from,
      _date_to,
      _credor,
      _operator_ids,
      NULL::text[],
      NULL::uuid
    ) p
  )
  SELECT
    COALESCE(SUM(b.proposed_total), 0)::numeric AS total_negociado,
    (SELECT total FROM received)::numeric AS total_recebido,
    GREATEST(
      COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status <> 'cancelled'), 0)
      - (SELECT total FROM received),
      0
    )::numeric AS total_pendente,
    COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status = 'cancelled'), 0)::numeric AS total_quebra,
    COUNT(*)::integer AS qtd_acordos,
    COUNT(*) FILTER (WHERE b.status <> 'cancelled')::integer AS qtd_acordos_ativos,
    COUNT(*) FILTER (WHERE b.status = 'cancelled')::integer AS qtd_quebras
  FROM base b;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_financial_summary(uuid,date,date,text[],uuid[]) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_revenue_summary(
  _tenant_id uuid,
  _date_from date DEFAULT NULL::date,
  _date_to date DEFAULT NULL::date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[],
  _channel text[] DEFAULT NULL::text[],
  _score_min integer DEFAULT NULL::integer,
  _score_max integer DEFAULT NULL::integer
)
RETURNS TABLE(
  total_negociado numeric,
  total_recebido numeric,
  total_pendente numeric,
  total_quebra numeric,
  ticket_medio numeric,
  qtd_acordos integer,
  qtd_acordos_ativos integer,
  qtd_quebras integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH s AS (
    SELECT *
    FROM public.get_financial_summary(_tenant_id, _date_from, _date_to, _credor, _operator_ids)
  )
  SELECT
    s.total_negociado,
    s.total_recebido,
    s.total_pendente,
    s.total_quebra,
    CASE WHEN s.qtd_acordos_ativos > 0
      THEN (s.total_negociado - s.total_quebra) / s.qtd_acordos_ativos
      ELSE 0
    END::numeric AS ticket_medio,
    s.qtd_acordos,
    s.qtd_acordos_ativos,
    s.qtd_quebras
  FROM s;
$function$;

GRANT EXECUTE ON FUNCTION public.get_bi_revenue_summary(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_revenue_by_period(
  _tenant_id uuid,
  _date_from date DEFAULT NULL::date,
  _date_to date DEFAULT NULL::date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[],
  _channel text[] DEFAULT NULL::text[],
  _score_min integer DEFAULT NULL::integer,
  _score_max integer DEFAULT NULL::integer,
  _granularity text DEFAULT 'month'::text
)
RETURNS TABLE(period date, total_negociado numeric, total_recebido numeric, qtd_acordos integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH gran AS (
    SELECT CASE WHEN _granularity IN ('day', 'week', 'month') THEN _granularity ELSE 'month' END AS value
  ),
  neg AS (
    SELECT
      date_trunc((SELECT value FROM gran), a.created_at)::date AS period,
      COALESCE(SUM(a.proposed_total), 0)::numeric AS total_negociado,
      COUNT(*)::integer AS qtd_acordos
    FROM public.agreements a
    WHERE a.tenant_id = public.resolve_financial_tenant(_tenant_id)
      AND a.status <> 'cancelled'
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to IS NULL OR a.created_at::date <= _date_to)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
    GROUP BY 1
  ),
  paid AS (
    SELECT
      date_trunc((SELECT value FROM gran), p.paid_at)::date AS period,
      COALESCE(SUM(p.amount_paid), 0)::numeric AS total_recebido
    FROM public.get_financial_confirmed_payments(
      _tenant_id,
      _date_from,
      _date_to,
      _credor,
      _operator_ids,
      NULL::text[],
      NULL::uuid
    ) p
    GROUP BY 1
  ),
  all_periods AS (
    SELECT period FROM neg
    UNION
    SELECT period FROM paid
  )
  SELECT
    ap.period,
    COALESCE(n.total_negociado, 0)::numeric AS total_negociado,
    COALESCE(p.total_recebido, 0)::numeric AS total_recebido,
    COALESCE(n.qtd_acordos, 0)::integer AS qtd_acordos
  FROM all_periods ap
  LEFT JOIN neg n ON n.period = ap.period
  LEFT JOIN paid p ON p.period = ap.period
  ORDER BY ap.period;
$function$;

GRANT EXECUTE ON FUNCTION public.get_bi_revenue_by_period(uuid,date,date,text[],uuid[],text[],integer,integer,text) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_revenue_by_credor(
  _tenant_id uuid,
  _date_from date DEFAULT NULL::date,
  _date_to date DEFAULT NULL::date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[],
  _channel text[] DEFAULT NULL::text[],
  _score_min integer DEFAULT NULL::integer,
  _score_max integer DEFAULT NULL::integer
)
RETURNS TABLE(
  credor text,
  total_negociado numeric,
  total_recebido numeric,
  total_pendente numeric,
  qtd_acordos integer,
  ticket_medio numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH base AS (
    SELECT a.id, a.credor, a.proposed_total, a.status
    FROM public.agreements a
    WHERE a.tenant_id = public.resolve_financial_tenant(_tenant_id)
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to IS NULL OR a.created_at::date <= _date_to)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  neg AS (
    SELECT
      b.credor,
      COALESCE(SUM(b.proposed_total), 0)::numeric AS total_negociado,
      COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status <> 'cancelled'), 0)::numeric AS total_negociado_ativo,
      COUNT(*)::integer AS qtd_acordos,
      COUNT(*) FILTER (WHERE b.status <> 'cancelled')::integer AS qtd_ativos
    FROM base b
    GROUP BY b.credor
  ),
  paid AS (
    SELECT
      p.credor,
      COALESCE(SUM(p.amount_paid), 0)::numeric AS total_recebido
    FROM public.get_financial_confirmed_payments(
      _tenant_id,
      _date_from,
      _date_to,
      _credor,
      _operator_ids,
      NULL::text[],
      NULL::uuid
    ) p
    GROUP BY p.credor
  )
  SELECT
    n.credor,
    n.total_negociado,
    COALESCE(p.total_recebido, 0)::numeric AS total_recebido,
    GREATEST(n.total_negociado_ativo - COALESCE(p.total_recebido, 0), 0)::numeric AS total_pendente,
    n.qtd_acordos,
    CASE WHEN n.qtd_ativos > 0 THEN n.total_negociado_ativo / n.qtd_ativos ELSE 0 END::numeric AS ticket_medio
  FROM neg n
  LEFT JOIN paid p ON p.credor = n.credor
  ORDER BY n.total_negociado DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_bi_revenue_by_credor(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_dashboard_stats_v2(
  _tenant_id uuid DEFAULT NULL::uuid,
  _user_id uuid DEFAULT NULL::uuid,
  _year integer DEFAULT NULL::integer,
  _month integer DEFAULT NULL::integer,
  _user_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  total_projetado numeric,
  total_negociado numeric,
  total_negociado_mes numeric,
  total_recebido numeric,
  total_quebra numeric,
  total_pendente numeric,
  acordos_dia bigint,
  acordos_mes bigint,
  acionados_ontem bigint,
  acordos_dia_anterior bigint,
  acordos_mes_anterior bigint,
  total_negociado_mes_anterior numeric,
  total_recebido_mes_anterior numeric,
  total_quebra_mes_anterior numeric,
  total_pendente_mes_anterior numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
  v_now timestamp with time zone := now();
  v_target_year int := COALESCE(_year, EXTRACT(YEAR FROM v_now)::int);
  v_target_month int := COALESCE(_month, EXTRACT(MONTH FROM v_now)::int);
  v_month_start date;
  v_month_end date;
  v_prev_month_start date;
  v_prev_month_end date;
  v_today date := CURRENT_DATE;
  v_yesterday date := CURRENT_DATE - 1;
  v_pending_floor date := CURRENT_DATE - 3;
  v_breakage_cutoff date := CURRENT_DATE - 10;
  v_operator_ids uuid[];
  v_no_op_filter boolean;
  v_projetado numeric := 0;
  v_negociado numeric := 0;
  v_negociado_mes numeric := 0;
  v_recebido numeric := 0;
  v_quebra numeric := 0;
  v_pendente numeric := 0;
  v_dia bigint := 0;
  v_mes bigint := 0;
  v_acionados_ontem bigint := 0;
  v_dia_ant bigint := 0;
  v_mes_ant bigint := 0;
  v_negociado_mes_ant numeric := 0;
  v_recebido_mes_ant numeric := 0;
  v_quebra_mes_ant numeric := 0;
  v_pendente_mes_ant numeric := 0;
BEGIN
  v_tenant_id := public.resolve_financial_tenant(_tenant_id);
  IF v_tenant_id IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint,
                        0::bigint, 0::bigint, 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  v_operator_ids := CASE
    WHEN _user_ids IS NOT NULL AND array_length(_user_ids, 1) IS NOT NULL THEN _user_ids
    WHEN _user_id IS NOT NULL THEN ARRAY[_user_id]
    ELSE NULL::uuid[]
  END;
  v_no_op_filter := v_operator_ids IS NULL;

  v_month_start := make_date(v_target_year, v_target_month, 1);
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
  v_prev_month_start := (v_month_start - interval '1 month')::date;
  v_prev_month_end := (v_month_start - interval '1 day')::date;

  SELECT COALESCE(SUM(fi.installment_amount), 0)::numeric INTO v_projetado
  FROM public.get_financial_agreement_installments(
    v_tenant_id,
    v_month_start,
    v_month_end,
    NULL::text[],
    v_operator_ids,
    NULL::uuid
  ) fi
  WHERE fi.agreement_status IN ('pending', 'approved')
    AND fi.agreement_created_at::date < v_month_start;

  SELECT COALESCE(SUM(
    CASE WHEN COALESCE(a.entrada_value, 0) > 0
      THEN COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value)
      ELSE COALESCE((a.custom_installment_values->>'1')::numeric, a.new_installment_value)
    END
  ), 0)::numeric INTO v_negociado
  FROM public.agreements a
  WHERE a.tenant_id = v_tenant_id
    AND a.created_at::date BETWEEN v_month_start AND v_month_end
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (v_no_op_filter OR a.created_by = ANY(v_operator_ids));

  SELECT COALESCE(SUM(fi.installment_amount), 0)::numeric INTO v_negociado_mes
  FROM public.get_financial_agreement_installments(
    v_tenant_id,
    NULL::date,
    NULL::date,
    NULL::text[],
    v_operator_ids,
    NULL::uuid
  ) fi
  WHERE fi.agreement_created_at::date BETWEEN v_month_start AND v_month_end
    AND fi.agreement_status NOT IN ('cancelled', 'rejected');

  SELECT COALESCE(SUM(fi.installment_amount), 0)::numeric INTO v_negociado_mes_ant
  FROM public.get_financial_agreement_installments(
    v_tenant_id,
    NULL::date,
    NULL::date,
    NULL::text[],
    v_operator_ids,
    NULL::uuid
  ) fi
  WHERE fi.agreement_created_at::date BETWEEN v_prev_month_start AND v_prev_month_end
    AND fi.agreement_status NOT IN ('cancelled', 'rejected');

  SELECT COALESCE(SUM(p.amount_paid), 0)::numeric INTO v_recebido
  FROM public.get_financial_confirmed_payments(
    v_tenant_id,
    v_month_start,
    v_month_end,
    NULL::text[],
    v_operator_ids,
    NULL::text[],
    NULL::uuid
  ) p;

  SELECT COALESCE(SUM(p.amount_paid), 0)::numeric INTO v_recebido_mes_ant
  FROM public.get_financial_confirmed_payments(
    v_tenant_id,
    v_prev_month_start,
    v_prev_month_end,
    NULL::text[],
    v_operator_ids,
    NULL::text[],
    NULL::uuid
  ) p;

  SELECT COALESCE(SUM(fi.installment_amount), 0)::numeric INTO v_quebra
  FROM public.get_financial_agreement_installments(
    v_tenant_id,
    v_month_start,
    v_month_end,
    NULL::text[],
    v_operator_ids,
    NULL::uuid
  ) fi
  WHERE fi.effective_status <> 'paid'
    AND (
      (fi.agreement_status = 'cancelled' AND COALESCE(fi.cancellation_type, '') IN ('auto_expired', 'manual'))
      OR (fi.agreement_status IN ('pending', 'approved', 'overdue', 'cancelled') AND fi.due_date <= v_breakage_cutoff)
    );

  SELECT COALESCE(SUM(fi.installment_amount), 0)::numeric INTO v_quebra_mes_ant
  FROM public.get_financial_agreement_installments(
    v_tenant_id,
    v_prev_month_start,
    v_prev_month_end,
    NULL::text[],
    v_operator_ids,
    NULL::uuid
  ) fi
  WHERE fi.effective_status <> 'paid'
    AND (
      (fi.agreement_status = 'cancelled' AND COALESCE(fi.cancellation_type, '') IN ('auto_expired', 'manual'))
      OR (fi.agreement_status IN ('pending', 'approved', 'overdue', 'cancelled') AND fi.due_date <= v_breakage_cutoff)
    );

  SELECT COALESCE(SUM(fi.installment_amount), 0)::numeric INTO v_pendente
  FROM public.get_financial_agreement_installments(
    v_tenant_id,
    GREATEST(v_month_start, v_pending_floor),
    v_month_end,
    NULL::text[],
    v_operator_ids,
    NULL::uuid
  ) fi
  WHERE fi.effective_status <> 'paid'
    AND fi.agreement_status IN ('pending', 'approved', 'overdue');

  SELECT COALESCE(SUM(fi.installment_amount), 0)::numeric INTO v_pendente_mes_ant
  FROM public.get_financial_agreement_installments(
    v_tenant_id,
    v_prev_month_start,
    v_prev_month_end,
    NULL::text[],
    v_operator_ids,
    NULL::uuid
  ) fi
  WHERE fi.effective_status <> 'paid'
    AND fi.agreement_status IN ('pending', 'approved', 'overdue');

  SELECT COUNT(*) INTO v_dia FROM public.agreements a
  WHERE a.tenant_id = v_tenant_id
    AND a.created_at::date = v_today
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (v_no_op_filter OR a.created_by = ANY(v_operator_ids));

  SELECT COUNT(*) INTO v_dia_ant FROM public.agreements a
  WHERE a.tenant_id = v_tenant_id
    AND a.created_at::date = v_yesterday
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (v_no_op_filter OR a.created_by = ANY(v_operator_ids));

  SELECT COUNT(*) INTO v_mes FROM public.agreements a
  WHERE a.tenant_id = v_tenant_id
    AND a.created_at::date BETWEEN v_month_start AND v_month_end
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (v_no_op_filter OR a.created_by = ANY(v_operator_ids));

  SELECT COUNT(*) INTO v_mes_ant FROM public.agreements a
  WHERE a.tenant_id = v_tenant_id
    AND a.created_at::date BETWEEN v_prev_month_start AND v_prev_month_end
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (v_no_op_filter OR a.created_by = ANY(v_operator_ids));

  WITH visited_cpfs AS (
    SELECT DISTINCT regexp_replace(COALESCE(NULLIF(split_part(ual.page_path, '/', 3), ''), ''), '\D', '', 'g') AS cpf
    FROM public.user_activity_logs ual
    WHERE ual.tenant_id = v_tenant_id
      AND ual.created_at >= date_trunc('day', now() - interval '1 day')
      AND ual.created_at < date_trunc('day', now())
      AND (v_no_op_filter OR ual.user_id = ANY(v_operator_ids))
  )
  SELECT COUNT(DISTINCT vc.cpf) INTO v_acionados_ontem
  FROM visited_cpfs vc
  WHERE vc.cpf <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.agreements ag
      WHERE ag.tenant_id = v_tenant_id
        AND regexp_replace(ag.client_cpf, '\D', '', 'g') = vc.cpf
        AND ag.created_at::date >= CURRENT_DATE - 1
    );

  RETURN QUERY SELECT
    v_projetado,
    v_negociado,
    v_negociado_mes,
    v_recebido,
    v_quebra,
    v_pendente,
    v_dia,
    v_mes,
    v_acionados_ontem,
    v_dia_ant,
    v_mes_ant,
    v_negociado_mes_ant,
    v_recebido_mes_ant,
    v_quebra_mes_ant,
    v_pendente_mes_ant;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats_v2(uuid,uuid,integer,integer,uuid[]) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_dashboard_vencimentos_v2(
  _tenant_id uuid DEFAULT NULL::uuid,
  _target_date date DEFAULT CURRENT_DATE,
  _user_id uuid DEFAULT NULL::uuid,
  _user_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  agreement_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  numero_parcela integer,
  total_parcelas integer,
  valor_parcela numeric,
  agreement_status text,
  effective_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
  v_operator_ids uuid[];
BEGIN
  v_tenant_id := public.resolve_financial_tenant(_tenant_id);
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  v_operator_ids := CASE
    WHEN _user_ids IS NOT NULL AND array_length(_user_ids, 1) IS NOT NULL THEN _user_ids
    WHEN _user_id IS NOT NULL THEN ARRAY[_user_id]
    ELSE NULL::uuid[]
  END;

  RETURN QUERY
  SELECT
    fi.agreement_id,
    fi.client_cpf,
    fi.client_name,
    fi.credor,
    fi.display_number AS numero_parcela,
    fi.total_installments AS total_parcelas,
    fi.installment_amount AS valor_parcela,
    fi.agreement_status,
    CASE WHEN fi.effective_status = 'cancelled' THEN 'overdue' ELSE fi.effective_status END AS effective_status
  FROM public.get_financial_agreement_installments(
    v_tenant_id,
    _target_date,
    _target_date,
    NULL::text[],
    v_operator_ids,
    NULL::uuid
  ) fi
  WHERE fi.agreement_status NOT IN ('cancelled', 'rejected')
  ORDER BY fi.client_name, fi.display_number;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_vencimentos_v2(uuid,date,uuid,uuid[]) TO authenticated;
