
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
  -- Entrada (parcela 0)
  SELECT
    a.id AS agreement_id,
    a.client_cpf,
    a.client_name,
    a.credor,
    0::int AS numero_parcela,
    a.entrada_value AS valor_parcela,
    a.status AS agreement_status
  FROM agreements a
  WHERE a.tenant_id = _tenant
    AND a.status IN ('pending', 'approved')
    AND (_user_id IS NULL OR a.created_by = _user_id)
    AND a.entrada_value > 0
    AND COALESCE(a.entrada_date, a.first_due_date)::date = _target_date

  UNION ALL

  -- Parcelas regulares
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
