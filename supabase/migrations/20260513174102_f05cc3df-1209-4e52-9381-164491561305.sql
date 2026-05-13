
-- Dashboard "Total Recebido" passa a ler da MESMA fonte que Baixas Realizadas
-- (manual_payments + portal_payments + negociarie_cobrancas) — Baixas é a verdade.

CREATE OR REPLACE FUNCTION public.get_dashboard_stats_v2(
  _user_id uuid DEFAULT NULL::uuid,
  _year integer DEFAULT NULL::integer,
  _month integer DEFAULT NULL::integer,
  _user_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  total_projetado numeric, total_negociado numeric, total_negociado_mes numeric,
  total_recebido numeric, total_quebra numeric, total_pendente numeric,
  acordos_dia bigint, acordos_mes bigint, acionados_ontem bigint,
  acordos_dia_anterior bigint, acordos_mes_anterior bigint,
  total_negociado_mes_anterior numeric, total_recebido_mes_anterior numeric,
  total_quebra_mes_anterior numeric, total_pendente_mes_anterior numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
  _today date := CURRENT_DATE;
  _target_year int := COALESCE(_year, EXTRACT(YEAR FROM _today)::int);
  _target_month int := COALESCE(_month, EXTRACT(MONTH FROM _today)::int);
  _month_start date;
  _month_end date;
  _prev_month_start date;
  _prev_month_last date;
  _prev_month_end date;
  _is_current_month boolean;
  _day_cutoff int;
  _no_op_filter boolean;
  _recebido numeric := 0;
  _recebido_ant numeric := 0;
  legacy record;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN
    RETURN QUERY SELECT 0::numeric,0::numeric,0::numeric,0::numeric,0::numeric,0::numeric,
                        0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
                        0::numeric,0::numeric,0::numeric,0::numeric;
    RETURN;
  END IF;

  _no_op_filter := (_user_id IS NULL AND (_user_ids IS NULL OR array_length(_user_ids,1) IS NULL));
  _month_start := make_date(_target_year, _target_month, 1);
  _month_end := (_month_start + interval '1 month' - interval '1 day')::date;
  _prev_month_start := (_month_start - interval '1 month')::date;
  _prev_month_last := (_month_start - interval '1 day')::date;
  _is_current_month := (_target_year = EXTRACT(YEAR FROM _today)::int
                        AND _target_month = EXTRACT(MONTH FROM _today)::int);
  IF _is_current_month THEN
    _day_cutoff := EXTRACT(DAY FROM _today)::int;
    _prev_month_end := LEAST(
      (_prev_month_start + ((_day_cutoff - 1) || ' days')::interval)::date,
      _prev_month_last
    );
  ELSE
    _prev_month_end := _prev_month_last;
  END IF;

  -- Recebido = mesma UNION de Baixas Realizadas (manual + portal + negociarie).
  -- Baixas é a verdade contábil.
  WITH unified AS (
    SELECT mp.amount_paid AS valor, mp.payment_date AS dt, a.created_by AS op
    FROM manual_payments mp
    JOIN agreements a ON a.id = mp.agreement_id
    WHERE mp.tenant_id = _tenant AND mp.status IN ('confirmed','approved')
    UNION ALL
    SELECT pp.amount, pp.updated_at::date, a.created_by
    FROM portal_payments pp
    JOIN agreements a ON a.id = pp.agreement_id
    WHERE pp.tenant_id = _tenant AND pp.status = 'paid'
    UNION ALL
    SELECT nc.valor_pago, nc.data_pagamento, a.created_by
    FROM negociarie_cobrancas nc
    JOIN agreements a ON a.id = nc.agreement_id
    WHERE nc.tenant_id = _tenant AND nc.status = 'pago'
  )
  SELECT
    COALESCE(SUM(valor) FILTER (WHERE dt BETWEEN _month_start AND _month_end), 0),
    COALESCE(SUM(valor) FILTER (WHERE dt BETWEEN _prev_month_start AND _prev_month_end), 0)
  INTO _recebido, _recebido_ant
  FROM unified
  WHERE _no_op_filter
     OR op = _user_id
     OR op = ANY(COALESCE(_user_ids,'{}'::uuid[]));

  -- Demais cálculos vêm da função legada.
  SELECT * INTO legacy FROM public.get_dashboard_stats(_user_id, _year, _month, _user_ids);

  RETURN QUERY SELECT
    legacy.total_projetado,
    legacy.total_negociado,
    legacy.total_negociado_mes,
    _recebido,
    legacy.total_quebra,
    legacy.total_pendente,
    legacy.acordos_dia,
    legacy.acordos_mes,
    legacy.acionados_ontem,
    legacy.acordos_dia_anterior,
    legacy.acordos_mes_anterior,
    legacy.total_negociado_mes_anterior,
    _recebido_ant,
    legacy.total_quebra_mes_anterior,
    legacy.total_pendente_mes_anterior;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_financial_received_by_day(
  _tenant_id uuid, _date_from date, _date_to date,
  _operator_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(payment_date date, total_recebido numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH unified AS (
    SELECT mp.payment_date AS dt, mp.amount_paid AS valor, a.created_by AS op
    FROM manual_payments mp
    JOIN agreements a ON a.id = mp.agreement_id
    WHERE mp.tenant_id = _tenant_id AND mp.status IN ('confirmed','approved')
      AND mp.payment_date BETWEEN _date_from AND _date_to
    UNION ALL
    SELECT pp.updated_at::date, pp.amount, a.created_by
    FROM portal_payments pp
    JOIN agreements a ON a.id = pp.agreement_id
    WHERE pp.tenant_id = _tenant_id AND pp.status = 'paid'
      AND pp.updated_at::date BETWEEN _date_from AND _date_to
    UNION ALL
    SELECT nc.data_pagamento, nc.valor_pago, a.created_by
    FROM negociarie_cobrancas nc
    JOIN agreements a ON a.id = nc.agreement_id
    WHERE nc.tenant_id = _tenant_id AND nc.status = 'pago'
      AND nc.data_pagamento BETWEEN _date_from AND _date_to
  )
  SELECT dt AS payment_date, SUM(valor)::numeric AS total_recebido
  FROM unified
  WHERE public.can_access_tenant(_tenant_id)
    AND (_operator_ids IS NULL OR op = ANY(_operator_ids))
  GROUP BY dt
  ORDER BY dt;
$function$;
