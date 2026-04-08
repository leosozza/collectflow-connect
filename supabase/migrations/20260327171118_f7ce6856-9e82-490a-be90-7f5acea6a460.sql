
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid DEFAULT NULL::uuid, _year integer DEFAULT NULL::integer, _month integer DEFAULT NULL::integer)
 RETURNS TABLE(total_projetado numeric, total_negociado numeric, total_negociado_mes numeric, total_recebido numeric, total_quebra numeric, total_pendente numeric, acordos_dia bigint, acordos_mes bigint)
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
  _today date := CURRENT_DATE;
  _projetado numeric := 0;
  _negociado numeric := 0;
  _negociado_mes numeric := 0;
  _recebido numeric := 0;
  _quebra numeric := 0;
  _pendente numeric := 0;
  _dia bigint := 0;
  _mes bigint := 0;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  _month_start := make_date(_target_year, _target_month, 1);
  _month_end := (_month_start + interval '1 month' - interval '1 day')::date;

  SELECT COALESCE(SUM(parcela_valor), 0) INTO _projetado
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved')
      AND a.created_at::date < _month_start
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start
      AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved')
      AND a.created_at::date < _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  SELECT COALESCE(SUM(
    CASE WHEN a.entrada_value > 0
      THEN COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value)
      ELSE COALESCE((a.custom_installment_values->>'1')::numeric, a.new_installment_value)
    END
  ), 0) INTO _negociado
  FROM agreements a
  WHERE a.tenant_id = _tenant
    AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR a.created_by = _user_id);

  SELECT COALESCE(SUM(parcela_valor), 0) INTO _negociado_mes
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status NOT IN ('cancelled', 'rejected')
      AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
      AND a.entrada_value > 0
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status NOT IN ('cancelled', 'rejected')
      AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  SELECT COALESCE(SUM((ce.metadata->>'valor_pago')::numeric), 0) INTO _recebido
  FROM client_events ce
  WHERE ce.tenant_id = _tenant
    AND ce.event_type = 'payment_confirmed'
    AND ce.created_at::date >= _month_start
    AND ce.created_at::date <= _month_end
    AND (
      _user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM agreements a
        WHERE a.id = (ce.metadata->>'agreement_id')::uuid
          AND a.created_by = _user_id
      )
    );

  SELECT COALESCE(SUM(parcela_valor), 0) INTO _quebra
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status = 'cancelled'
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start
      AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status = 'cancelled'
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  SELECT COALESCE(SUM(parcela_valor), 0) INTO _pendente
  FROM (
    SELECT COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved', 'overdue')
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start
      AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT COALESCE((a.custom_installment_values->>cast(gs.i as text))::numeric, a.new_installment_value) AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved', 'overdue')
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  SELECT COUNT(*) INTO _dia
  FROM agreements
  WHERE tenant_id = _tenant
    AND created_at::date = _today
    AND status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR created_by = _user_id);

  SELECT COUNT(*) INTO _mes
  FROM agreements
  WHERE tenant_id = _tenant
    AND created_at::date >= _month_start AND created_at::date <= _month_end
    AND status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR created_by = _user_id);

  RETURN QUERY SELECT _projetado, _negociado, _negociado_mes, _recebido, _quebra, _pendente, _dia, _mes;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_vencimentos(_target_date date, _user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(agreement_id uuid, client_cpf text, client_name text, credor text, numero_parcela integer, valor_parcela numeric, agreement_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    a.id AS agreement_id,
    a.client_cpf,
    a.client_name,
    a.credor,
    1::int AS numero_parcela,
    COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS valor_parcela,
    (CASE 
      WHEN EXISTS (
        SELECT 1 FROM manual_payments mp 
        WHERE mp.agreement_id = a.id AND mp.installment_number = 1 AND mp.status = 'confirmed'
      ) THEN 'approved'
      ELSE a.status
    END) AS agreement_status
  FROM agreements a
  WHERE a.tenant_id = _tenant
    AND a.status IN ('pending', 'overdue', 'approved')
    AND (_user_id IS NULL OR a.created_by = _user_id)
    AND a.entrada_value > 0
    AND COALESCE(a.entrada_date, a.first_due_date)::date = _target_date

  UNION ALL

  SELECT
    a.id AS agreement_id,
    a.client_cpf,
    a.client_name,
    a.credor,
    (CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END)::int AS numero_parcela,
    COALESCE((a.custom_installment_values->>cast(
      CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END
    as text))::numeric, a.new_installment_value) AS valor_parcela,
    (CASE 
      WHEN EXISTS (
        SELECT 1 FROM manual_payments mp 
        WHERE mp.agreement_id = a.id 
          AND mp.installment_number = (CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END) 
          AND mp.status = 'confirmed'
      ) THEN 'approved'
      ELSE a.status
    END) AS agreement_status
  FROM agreements a
  CROSS JOIN LATERAL generate_series(0, a.new_installments - 1) AS i
  WHERE a.tenant_id = _tenant
    AND a.status IN ('pending', 'overdue', 'approved')
    AND (_user_id IS NULL OR a.created_by = _user_id)
    AND (a.first_due_date::date + (i * interval '1 month'))::date = _target_date;
END;
$function$;
