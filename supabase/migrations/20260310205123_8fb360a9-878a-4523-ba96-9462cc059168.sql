
-- RPC: get_dashboard_stats
-- Returns aggregated dashboard metrics based on formalized agreements only
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _user_id uuid DEFAULT NULL,
  _year int DEFAULT NULL,
  _month int DEFAULT NULL
)
RETURNS TABLE(
  total_projetado numeric,
  total_negociado numeric,
  total_recebido numeric,
  total_quebra numeric,
  total_pendente numeric,
  acordos_dia bigint,
  acordos_mes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  _recebido numeric := 0;
  _quebra numeric := 0;
  _pendente numeric := 0;
  _dia bigint := 0;
  _mes bigint := 0;
BEGIN
  -- Get tenant for current auth user
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  _month_start := make_date(_target_year, _target_month, 1);
  _month_end := (_month_start + interval '1 month' - interval '1 day')::date;

  -- Total Projetado: SUM of proposed_total from active agreements (pending/approved)
  SELECT COALESCE(SUM(proposed_total), 0) INTO _projetado
  FROM agreements
  WHERE tenant_id = _tenant
    AND status IN ('pending', 'approved')
    AND (_user_id IS NULL OR created_by = _user_id);

  -- Total Negociado: SUM of proposed_total from agreements created in the target month
  SELECT COALESCE(SUM(proposed_total), 0) INTO _negociado
  FROM agreements
  WHERE tenant_id = _tenant
    AND created_at::date >= _month_start AND created_at::date <= _month_end
    AND status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR created_by = _user_id);

  -- Total Recebido: SUM of valor_pago from clients whose CPF has an active agreement
  SELECT COALESCE(SUM(c.valor_pago), 0) INTO _recebido
  FROM clients c
  WHERE c.tenant_id = _tenant
    AND c.status = 'pago'
    AND EXISTS (
      SELECT 1 FROM agreements a
      WHERE a.tenant_id = _tenant
        AND REPLACE(a.client_cpf, '.', '') = REPLACE(REPLACE(c.cpf, '.', ''), '-', '')
        AND a.status IN ('pending', 'approved')
        AND (_user_id IS NULL OR a.created_by = _user_id)
    );

  -- Total Quebra: SUM of proposed_total from cancelled/overdue agreements
  SELECT COALESCE(SUM(proposed_total), 0) INTO _quebra
  FROM agreements
  WHERE tenant_id = _tenant
    AND status IN ('cancelled', 'overdue')
    AND (_user_id IS NULL OR created_by = _user_id);

  -- Total Pendente
  _pendente := GREATEST(_projetado - _recebido - _quebra, 0);

  -- Acordos do dia
  SELECT COUNT(*) INTO _dia
  FROM agreements
  WHERE tenant_id = _tenant
    AND created_at::date = _today
    AND status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR created_by = _user_id);

  -- Acordos do mês
  SELECT COUNT(*) INTO _mes
  FROM agreements
  WHERE tenant_id = _tenant
    AND created_at::date >= _month_start AND created_at::date <= _month_end
    AND status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR created_by = _user_id);

  RETURN QUERY SELECT _projetado, _negociado, _recebido, _quebra, _pendente, _dia, _mes;
END;
$$;

-- RPC: get_dashboard_vencimentos
-- Returns virtual installments from agreements for a specific date
CREATE OR REPLACE FUNCTION public.get_dashboard_vencimentos(
  _target_date date,
  _user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  agreement_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  numero_parcela int,
  valor_parcela numeric,
  agreement_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    (i + 1)::int AS numero_parcela,
    a.new_installment_value AS valor_parcela,
    a.status AS agreement_status
  FROM agreements a
  CROSS JOIN LATERAL generate_series(0, a.new_installments - 1) AS i
  WHERE a.tenant_id = _tenant
    AND a.status IN ('pending', 'approved')
    AND (_user_id IS NULL OR a.created_by = _user_id)
    AND (a.first_due_date::date + (i * interval '1 month'))::date = _target_date;
END;
$$;
