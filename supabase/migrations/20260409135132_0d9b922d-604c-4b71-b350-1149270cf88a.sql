
CREATE OR REPLACE FUNCTION public.get_dashboard_vencimentos(
  _target_date date DEFAULT CURRENT_DATE,
  _user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  agreement_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  numero_parcela int,
  valor_parcela numeric,
  agreement_status text,
  effective_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    1::int AS numero_parcela,
    COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS valor_parcela,
    a.status AS agreement_status,
    CASE
      WHEN a.status = 'approved' THEN 'paid'
      WHEN EXISTS (
        SELECT 1 FROM manual_payments mp
        WHERE mp.agreement_id = a.id AND mp.installment_number = 0 AND mp.status = 'confirmed'
      ) THEN 'paid'
      WHEN EXISTS (
        SELECT 1 FROM negociarie_cobrancas nc
        WHERE nc.agreement_id = a.id AND nc.installment_key = a.id::text || ':0' AND nc.status = 'pago'
      ) THEN 'paid'
      WHEN a.status = 'overdue' THEN 'overdue'
      WHEN COALESCE(a.entrada_date, a.first_due_date)::date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END AS effective_status
  FROM agreements a
  WHERE a.tenant_id = _tenant
    AND a.status NOT IN ('cancelled', 'rejected')
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
    (CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END)::int AS numero_parcela,
    COALESCE((a.custom_installment_values->>cast(
      CASE WHEN a.entrada_value > 0 THEN i + 2 ELSE i + 1 END
    as text))::numeric, a.new_installment_value) AS valor_parcela,
    a.status AS agreement_status,
    CASE
      WHEN a.status = 'approved' THEN 'paid'
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
      WHEN (a.first_due_date::date + (i * interval '1 month'))::date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END AS effective_status
  FROM agreements a
  CROSS JOIN LATERAL generate_series(0, a.new_installments - 1) AS i
  WHERE a.tenant_id = _tenant
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR a.created_by = _user_id)
    AND (a.first_due_date::date + (i * interval '1 month'))::date = _target_date;
END;
$function$;
