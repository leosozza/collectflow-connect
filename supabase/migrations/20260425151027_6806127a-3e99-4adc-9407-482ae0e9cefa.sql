-- =========================================================================
-- get_dashboard_stats: quebra inclui manual; recebido usa manual+portal;
--                      suporte a multi-operador via _user_ids uuid[]
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _user_id uuid DEFAULT NULL::uuid,
  _year integer DEFAULT NULL::integer,
  _month integer DEFAULT NULL::integer,
  _user_ids uuid[] DEFAULT NULL::uuid[]
)
 RETURNS TABLE(total_projetado numeric, total_negociado numeric, total_negociado_mes numeric, total_recebido numeric, total_quebra numeric, total_pendente numeric, acordos_dia bigint, acordos_mes bigint, acionados_ontem bigint, acordos_dia_anterior bigint, acordos_mes_anterior bigint, total_negociado_mes_anterior numeric, total_recebido_mes_anterior numeric, total_quebra_mes_anterior numeric, total_pendente_mes_anterior numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
  _now timestamp with time zone := now();
  _target_year int := COALESCE(_year, EXTRACT(YEAR FROM _now)::int);
  _target_month int := COALESCE(_month, EXTRACT(MONTH FROM _now)::int);
  _month_start date;
  _month_end date;
  _prev_month_start date;
  _prev_month_end date;
  _today date := CURRENT_DATE;
  _yesterday date := CURRENT_DATE - 1;
  _projetado numeric := 0;
  _negociado numeric := 0;
  _negociado_mes numeric := 0;
  _recebido numeric := 0;
  _quebra numeric := 0;
  _pendente numeric := 0;
  _dia bigint := 0;
  _mes bigint := 0;
  _acionados_ontem bigint := 0;
  _dia_ant bigint := 0;
  _mes_ant bigint := 0;
  _negociado_mes_ant numeric := 0;
  _recebido_mes_ant numeric := 0;
  _quebra_mes_ant numeric := 0;
  _pendente_mes_ant numeric := 0;
  _no_op_filter boolean;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint,
                        0::bigint, 0::bigint, 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  -- Filtro vazio (null/empty) = todos os operadores
  _no_op_filter := (_user_id IS NULL AND (_user_ids IS NULL OR array_length(_user_ids, 1) IS NULL));

  _month_start := make_date(_target_year, _target_month, 1);
  _month_end := (_month_start + interval '1 month' - interval '1 day')::date;
  _prev_month_start := (_month_start - interval '1 month')::date;
  _prev_month_end := (_month_start - interval '1 day')::date;

  -- TOTAL PROJETADO (mês corrente)
  SELECT COALESCE(SUM(parcela_valor), 0) INTO _projetado
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant AND a.status IN ('pending', 'approved') AND a.created_at::date < _month_start AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant AND a.status IN ('pending', 'approved') AND a.created_at::date < _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ) sub;

  SELECT COALESCE(SUM(
    CASE WHEN a.entrada_value > 0
      THEN COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value)
      ELSE COALESCE((a.custom_installment_values->>'1')::numeric, a.new_installment_value)
    END
  ), 0) INTO _negociado
  FROM agreements a
  WHERE a.tenant_id = _tenant AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])));

  SELECT COALESCE(SUM(parcela_valor), 0) INTO _negociado_mes
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant AND a.status NOT IN ('cancelled', 'rejected')
      AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end AND a.entrada_value > 0
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant AND a.status NOT IN ('cancelled', 'rejected')
      AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ) sub;

  SELECT COALESCE(SUM(parcela_valor), 0) INTO _negociado_mes_ant
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant AND a.status NOT IN ('cancelled', 'rejected')
      AND a.created_at::date >= _prev_month_start AND a.created_at::date <= _prev_month_end AND a.entrada_value > 0
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant AND a.status NOT IN ('cancelled', 'rejected')
      AND a.created_at::date >= _prev_month_start AND a.created_at::date <= _prev_month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ) sub;

  -- TOTAL RECEBIDO: fonte oficial = manual_payments(confirmed) + portal_payments(paid)
  SELECT COALESCE((
    SELECT SUM(mp.amount_paid)
    FROM manual_payments mp
    JOIN agreements a ON a.id = mp.agreement_id
    WHERE mp.tenant_id = _tenant
      AND mp.status = 'confirmed'
      AND mp.payment_date BETWEEN _month_start AND _month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ), 0)
  +
  COALESCE((
    SELECT SUM(pp.amount)
    FROM portal_payments pp
    JOIN agreements a ON a.id = pp.agreement_id
    WHERE pp.tenant_id = _tenant
      AND pp.status = 'paid'
      AND pp.updated_at >= _month_start::timestamptz
      AND pp.updated_at <  (_month_end + 1)::timestamptz
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ), 0)
  INTO _recebido;

  SELECT COALESCE((
    SELECT SUM(mp.amount_paid)
    FROM manual_payments mp
    JOIN agreements a ON a.id = mp.agreement_id
    WHERE mp.tenant_id = _tenant
      AND mp.status = 'confirmed'
      AND mp.payment_date BETWEEN _prev_month_start AND _prev_month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ), 0)
  +
  COALESCE((
    SELECT SUM(pp.amount)
    FROM portal_payments pp
    JOIN agreements a ON a.id = pp.agreement_id
    WHERE pp.tenant_id = _tenant
      AND pp.status = 'paid'
      AND pp.updated_at >= _prev_month_start::timestamptz
      AND pp.updated_at <  (_prev_month_end + 1)::timestamptz
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ), 0)
  INTO _recebido_mes_ant;

  -- TOTAL DE QUEBRA: inclui cancelamentos manuais (auto_expired + manual)
  SELECT COALESCE(SUM(parcela_valor), 0) INTO _quebra
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant AND a.status = 'cancelled'
      AND a.cancellation_type IN ('auto_expired','manual')
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant AND a.status = 'cancelled'
      AND a.cancellation_type IN ('auto_expired','manual')
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ) sub;

  SELECT COALESCE(SUM(parcela_valor), 0) INTO _quebra_mes_ant
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant AND a.status = 'cancelled'
      AND a.cancellation_type IN ('auto_expired','manual')
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _prev_month_start AND COALESCE(a.entrada_date, a.first_due_date) <= _prev_month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant AND a.status = 'cancelled'
      AND a.cancellation_type IN ('auto_expired','manual')
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _prev_month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _prev_month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ) sub;

  SELECT COALESCE(SUM(parcela_valor), 0) INTO _pendente
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant AND a.status IN ('pending', 'approved', 'overdue') AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant AND a.status IN ('pending', 'approved', 'overdue')
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ) sub;

  _pendente := GREATEST(_pendente - _recebido, 0);

  SELECT COALESCE(SUM(parcela_valor), 0) INTO _pendente_mes_ant
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant AND a.status IN ('pending', 'approved', 'overdue') AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _prev_month_start AND COALESCE(a.entrada_date, a.first_due_date) <= _prev_month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant AND a.status IN ('pending', 'approved', 'overdue')
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _prev_month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _prev_month_end
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ) sub;

  _pendente_mes_ant := GREATEST(_pendente_mes_ant - _recebido_mes_ant, 0);

  SELECT COUNT(*) INTO _dia FROM agreements
  WHERE tenant_id = _tenant AND created_at::date = _today AND status NOT IN ('cancelled', 'rejected')
    AND (_no_op_filter OR created_by = _user_id OR created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])));

  SELECT COUNT(*) INTO _dia_ant FROM agreements
  WHERE tenant_id = _tenant AND created_at::date = _yesterday AND status NOT IN ('cancelled', 'rejected')
    AND (_no_op_filter OR created_by = _user_id OR created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])));

  SELECT COUNT(*) INTO _mes FROM agreements
  WHERE tenant_id = _tenant AND created_at::date >= _month_start AND created_at::date <= _month_end
    AND status NOT IN ('cancelled', 'rejected')
    AND (_no_op_filter OR created_by = _user_id OR created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])));

  SELECT COUNT(*) INTO _mes_ant FROM agreements
  WHERE tenant_id = _tenant AND created_at::date >= _prev_month_start AND created_at::date <= _prev_month_end
    AND status NOT IN ('cancelled', 'rejected')
    AND (_no_op_filter OR created_by = _user_id OR created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])));

  WITH visited_cpfs AS (
    SELECT DISTINCT
      regexp_replace(
        COALESCE(NULLIF(split_part(ual.page_path, '/', 3), ''), ''),
        '\D', '', 'g'
      ) AS cpf
    FROM public.user_activity_logs ual
    WHERE ual.tenant_id = _tenant
      AND ual.created_at >= date_trunc('day', now() - interval '1 day')
      AND ual.created_at < date_trunc('day', now())
      AND ual.activity_type = 'page_view'
      AND (ual.page_path LIKE '/carteira/%' OR ual.page_path LIKE '/atendimento/%')
      AND (_no_op_filter OR ual.user_id = _user_id OR ual.user_id = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ),
  agreed_yesterday AS (
    SELECT DISTINCT regexp_replace(a.client_cpf, '\D', '', 'g') AS cpf
    FROM public.agreements a
    WHERE a.tenant_id = _tenant
      AND a.created_at >= date_trunc('day', now() - interval '1 day')
      AND a.created_at <  date_trunc('day', now())
      AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  )
  SELECT COUNT(*) INTO _acionados_ontem
  FROM visited_cpfs v
  WHERE v.cpf <> ''
    AND length(v.cpf) >= 11
    AND NOT EXISTS (SELECT 1 FROM agreed_yesterday a WHERE a.cpf = v.cpf);

  RETURN QUERY SELECT
    _projetado, _negociado, _negociado_mes, _recebido, _quebra, _pendente, _dia, _mes,
    COALESCE(_acionados_ontem, 0), _dia_ant, _mes_ant,
    _negociado_mes_ant, _recebido_mes_ant, _quebra_mes_ant, _pendente_mes_ant;
END;
$function$;

-- =========================================================================
-- get_dashboard_vencimentos: remove "approved => paid"; suporte multi-operador
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_vencimentos(
  _target_date date DEFAULT CURRENT_DATE,
  _user_id uuid DEFAULT NULL::uuid,
  _user_ids uuid[] DEFAULT NULL::uuid[]
)
 RETURNS TABLE(agreement_id uuid, client_cpf text, client_name text, credor text, numero_parcela integer, valor_parcela numeric, agreement_status text, effective_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
  _no_op_filter boolean;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN RETURN; END IF;

  _no_op_filter := (_user_id IS NULL AND (_user_ids IS NULL OR array_length(_user_ids, 1) IS NULL));

  RETURN QUERY
  -- Entrada
  SELECT
    a.id AS agreement_id,
    a.client_cpf,
    a.client_name,
    a.credor,
    1::int AS numero_parcela,
    COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS valor_parcela,
    a.status AS agreement_status,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM manual_payments mp
        WHERE mp.agreement_id = a.id AND mp.installment_number = 0 AND mp.status = 'confirmed'
      ) THEN 'paid'
      WHEN EXISTS (
        SELECT 1 FROM negociarie_cobrancas nc
        WHERE nc.agreement_id = a.id AND nc.installment_key = a.id::text || ':0' AND nc.status = 'pago'
      ) THEN 'paid'
      WHEN a.status = 'overdue' THEN 'overdue'
      WHEN COALESCE(
        (a.custom_installment_dates->>'entrada')::date,
        a.entrada_date,
        a.first_due_date
      )::date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END AS effective_status
  FROM agreements a
  WHERE a.tenant_id = _tenant
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
    AND a.entrada_value > 0
    AND COALESCE(
      (a.custom_installment_dates->>'entrada')::date,
      a.entrada_date,
      a.first_due_date
    )::date = _target_date

  UNION ALL

  -- Parcelas regulares
  SELECT
    a.id AS agreement_id,
    a.client_cpf,
    a.client_name,
    a.credor,
    (CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END)::int AS numero_parcela,
    COALESCE((a.custom_installment_values->>cast(
      CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END
    as text))::numeric, a.new_installment_value) AS valor_parcela,
    a.status AS agreement_status,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM manual_payments mp
        WHERE mp.agreement_id = a.id
          AND mp.installment_number = (CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END)
          AND mp.status = 'confirmed'
      ) THEN 'paid'
      WHEN EXISTS (
        SELECT 1 FROM negociarie_cobrancas nc
        WHERE nc.agreement_id = a.id
          AND nc.installment_key = a.id::text || ':' || (CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END)::text
          AND nc.status = 'pago'
      ) THEN 'paid'
      WHEN a.status = 'overdue' THEN 'overdue'
      WHEN COALESCE(
        (a.custom_installment_dates->>cast(
          CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END
        as text))::date,
        (a.first_due_date::date + (i * interval '1 month'))::date
      ) < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END AS effective_status
  FROM agreements a
  CROSS JOIN LATERAL generate_series(0, a.new_installments - 1) AS i
  WHERE a.tenant_id = _tenant
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
    AND COALESCE(
      (a.custom_installment_dates->>cast(
        CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END
      as text))::date,
      (a.first_due_date::date + (i * interval '1 month'))::date
    ) = _target_date;
END;
$function$;

-- =========================================================================
-- get_acionados_hoje: suporte multi-operador
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_acionados_hoje(
  _user_id uuid DEFAULT NULL::uuid,
  _tenant_id uuid DEFAULT NULL::uuid,
  _user_ids uuid[] DEFAULT NULL::uuid[]
)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_count bigint;
  v_no_op_filter boolean;
BEGIN
  v_tenant_id := COALESCE(_tenant_id, public.get_my_tenant_id());

  IF v_tenant_id IS NULL THEN
    RETURN 0;
  END IF;

  v_no_op_filter := (_user_id IS NULL AND (_user_ids IS NULL OR array_length(_user_ids, 1) IS NULL));

  WITH visited_cpfs AS (
    SELECT DISTINCT
      regexp_replace(
        COALESCE(NULLIF(split_part(ual.page_path, '/', 3), ''), ''),
        '\D', '', 'g'
      ) AS cpf
    FROM public.user_activity_logs ual
    WHERE ual.tenant_id = v_tenant_id
      AND ual.created_at >= date_trunc('day', now())
      AND ual.created_at < date_trunc('day', now()) + interval '1 day'
      AND ual.activity_type = 'page_view'
      AND (ual.page_path LIKE '/carteira/%' OR ual.page_path LIKE '/atendimento/%')
      AND (v_no_op_filter OR ual.user_id = _user_id OR ual.user_id = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  ),
  agreed_today AS (
    SELECT DISTINCT regexp_replace(a.client_cpf, '\D', '', 'g') AS cpf
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND a.created_at >= date_trunc('day', now())
      AND a.created_at <  date_trunc('day', now()) + interval '1 day'
      AND (v_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
  )
  SELECT COUNT(*) INTO v_count
  FROM visited_cpfs v
  WHERE v.cpf <> ''
    AND length(v.cpf) >= 11
    AND NOT EXISTS (SELECT 1 FROM agreed_today a WHERE a.cpf = v.cpf);

  RETURN COALESCE(v_count, 0);
END;
$function$;