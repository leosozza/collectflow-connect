-- Align RIVO financial/operational metric contracts.
-- Safe production migration: no data rewrite, no drops, no table recreation.
-- Existing credores keep their configured prazo_dias_acordo; only the default
-- for new credores changes to the business default of 10 days.

ALTER TABLE public.credores
  ALTER COLUMN prazo_dias_acordo SET DEFAULT 10;


CREATE OR REPLACE FUNCTION public.get_agreement_expiration_days(
  _tenant_id uuid,
  _credor text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
  v_days integer;
BEGIN
  v_tenant_id := public.resolve_financial_tenant(_tenant_id);
  IF v_tenant_id IS NULL OR NULLIF(btrim(COALESCE(_credor, '')), '') IS NULL THEN
    RETURN 10;
  END IF;

  SELECT GREATEST(COALESCE(c.prazo_dias_acordo, 10), 1)::integer
    INTO v_days
  FROM public.credores c
  WHERE c.tenant_id = v_tenant_id
    AND (
      lower(btrim(COALESCE(c.razao_social, ''))) = lower(btrim(_credor))
      OR lower(btrim(COALESCE(c.nome_fantasia, ''))) = lower(btrim(_credor))
    )
  ORDER BY
    CASE WHEN lower(btrim(COALESCE(c.razao_social, ''))) = lower(btrim(_credor)) THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN COALESCE(v_days, 10);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_agreement_expiration_days(uuid,text) TO authenticated;


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
  WITH valid_agreements AS (
    SELECT a.id, COALESCE(a.proposed_total, 0)::numeric AS proposed_total
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND a.status NOT IN ('cancelled', 'rejected')
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to IS NULL OR a.created_at::date <= _date_to)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  broken_agreements AS (
    SELECT a.id, COALESCE(a.proposed_total, 0)::numeric AS proposed_total
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND a.status = 'cancelled'
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
  ),
  totals AS (
    SELECT
      COALESCE((SELECT SUM(va.proposed_total) FROM valid_agreements va), 0)::numeric AS valid_total,
      COALESCE((SELECT COUNT(*) FROM valid_agreements), 0)::integer AS valid_count,
      COALESCE((SELECT SUM(ba.proposed_total) FROM broken_agreements ba), 0)::numeric AS broken_total,
      COALESCE((SELECT COUNT(*) FROM broken_agreements), 0)::integer AS broken_count,
      (SELECT total FROM received)::numeric AS received_total
  )
  SELECT
    t.valid_total AS total_negociado,
    t.received_total AS total_recebido,
    GREATEST(t.valid_total - t.received_total, 0)::numeric AS total_pendente,
    t.broken_total AS total_quebra,
    t.valid_count AS qtd_acordos,
    t.valid_count AS qtd_acordos_ativos,
    t.broken_count AS qtd_quebras
  FROM totals t;
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
      THEN s.total_negociado / s.qtd_acordos_ativos
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
  tenant AS (
    SELECT public.resolve_financial_tenant(_tenant_id) AS id
  ),
  neg AS (
    SELECT
      date_trunc((SELECT value FROM gran), a.created_at)::date AS period,
      COALESCE(SUM(a.proposed_total), 0)::numeric AS total_negociado,
      COUNT(*)::integer AS qtd_acordos
    FROM public.agreements a
    WHERE a.tenant_id = (SELECT id FROM tenant)
      AND a.status NOT IN ('cancelled', 'rejected')
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
  WITH tenant AS (
    SELECT public.resolve_financial_tenant(_tenant_id) AS id
  ),
  neg AS (
    SELECT
      a.credor,
      COALESCE(SUM(a.proposed_total), 0)::numeric AS total_negociado,
      COUNT(*)::integer AS qtd_acordos
    FROM public.agreements a
    WHERE a.tenant_id = (SELECT id FROM tenant)
      AND a.status NOT IN ('cancelled', 'rejected')
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to IS NULL OR a.created_at::date <= _date_to)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
    GROUP BY a.credor
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
    GREATEST(n.total_negociado - COALESCE(p.total_recebido, 0), 0)::numeric AS total_pendente,
    n.qtd_acordos,
    CASE WHEN n.qtd_acordos > 0 THEN n.total_negociado / n.qtd_acordos ELSE 0 END::numeric AS ticket_medio
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
  WHERE fi.agreement_status IN ('pending', 'approved', 'overdue')
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

  WITH installments AS (
    SELECT
      fi.*,
      public.get_agreement_expiration_days(v_tenant_id, fi.credor) AS expiration_days,
      (v_today - fi.due_date)::integer AS days_overdue
    FROM public.get_financial_agreement_installments(
      v_tenant_id,
      v_month_start,
      v_month_end,
      NULL::text[],
      v_operator_ids,
      NULL::uuid
    ) fi
    WHERE fi.effective_status <> 'paid'
  )
  SELECT COALESCE(SUM(i.installment_amount), 0)::numeric INTO v_quebra
  FROM installments i
  WHERE (
    (
      i.agreement_status = 'cancelled'
      AND COALESCE(i.cancellation_type, '') IN ('auto_expired', 'manual')
      AND i.due_date <= i.agreement_updated_at::date
    )
    OR (
      i.agreement_status IN ('pending', 'approved', 'overdue', 'cancelled')
      AND i.days_overdue >= LEAST(3, i.expiration_days)
    )
  );

  WITH installments AS (
    SELECT
      fi.*,
      public.get_agreement_expiration_days(v_tenant_id, fi.credor) AS expiration_days,
      (v_today - fi.due_date)::integer AS days_overdue
    FROM public.get_financial_agreement_installments(
      v_tenant_id,
      v_prev_month_start,
      v_prev_month_end,
      NULL::text[],
      v_operator_ids,
      NULL::uuid
    ) fi
    WHERE fi.effective_status <> 'paid'
  )
  SELECT COALESCE(SUM(i.installment_amount), 0)::numeric INTO v_quebra_mes_ant
  FROM installments i
  WHERE (
    (
      i.agreement_status = 'cancelled'
      AND COALESCE(i.cancellation_type, '') IN ('auto_expired', 'manual')
      AND i.due_date <= i.agreement_updated_at::date
    )
    OR (
      i.agreement_status IN ('pending', 'approved', 'overdue', 'cancelled')
      AND i.days_overdue >= LEAST(3, i.expiration_days)
    )
  );

  WITH installments AS (
    SELECT
      fi.*,
      public.get_agreement_expiration_days(v_tenant_id, fi.credor) AS expiration_days,
      (v_today - fi.due_date)::integer AS days_overdue
    FROM public.get_financial_agreement_installments(
      v_tenant_id,
      v_month_start,
      v_month_end,
      NULL::text[],
      v_operator_ids,
      NULL::uuid
    ) fi
    WHERE fi.effective_status <> 'paid'
      AND fi.agreement_status IN ('pending', 'approved', 'overdue')
  )
  SELECT COALESCE(SUM(i.installment_amount), 0)::numeric INTO v_pendente
  FROM installments i
  WHERE i.days_overdue < LEAST(3, i.expiration_days);

  WITH installments AS (
    SELECT
      fi.*,
      public.get_agreement_expiration_days(v_tenant_id, fi.credor) AS expiration_days,
      (v_today - fi.due_date)::integer AS days_overdue
    FROM public.get_financial_agreement_installments(
      v_tenant_id,
      v_prev_month_start,
      v_prev_month_end,
      NULL::text[],
      v_operator_ids,
      NULL::uuid
    ) fi
    WHERE fi.effective_status <> 'paid'
      AND fi.agreement_status IN ('pending', 'approved', 'overdue')
  )
  SELECT COALESCE(SUM(i.installment_amount), 0)::numeric INTO v_pendente_mes_ant
  FROM installments i
  WHERE i.days_overdue < LEAST(3, i.expiration_days);

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
        AND regexp_replace(COALESCE(ag.client_cpf, ''), '\D', '', 'g') = vc.cpf
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


CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT *
  FROM public.get_dashboard_stats_v2(NULL::uuid, _user_id, _year, _month, _user_ids);
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid,integer,integer,uuid[]) TO authenticated;
