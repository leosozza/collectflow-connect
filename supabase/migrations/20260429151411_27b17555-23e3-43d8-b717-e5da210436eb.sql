-- 1) Coluna para guardar parcelas canceladas individualmente
ALTER TABLE public.agreements
  ADD COLUMN IF NOT EXISTS cancelled_installments jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Atualiza RPC de vencimentos do dashboard para ignorar parcelas canceladas
DROP FUNCTION IF EXISTS public.get_dashboard_vencimentos(date, uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.get_dashboard_vencimentos(_target_date date DEFAULT CURRENT_DATE, _user_id uuid DEFAULT NULL::uuid, _user_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(agreement_id uuid, client_cpf text, client_name text, credor text, numero_parcela integer, total_parcelas integer, valor_parcela numeric, agreement_status text, effective_status text)
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
    (a.new_installments + CASE WHEN a.entrada_value > 0 THEN 1 ELSE 0 END)::int AS total_parcelas,
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
    AND NOT (COALESCE(a.cancelled_installments, '{}'::jsonb) ? 'entrada')
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
    (a.new_installments + CASE WHEN a.entrada_value > 0 THEN 1 ELSE 0 END)::int AS total_parcelas,
    COALESCE((a.custom_installment_values->>cast(i + 1 as text))::numeric, a.new_installment_value) AS valor_parcela,
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
          AND nc.installment_key = a.id::text || ':' || (i + 1)::text
          AND nc.status = 'pago'
      ) THEN 'paid'
      WHEN a.status = 'overdue' THEN 'overdue'
      WHEN COALESCE(
        (a.custom_installment_dates->>cast(i + 1 as text))::date,
        (a.first_due_date::date + (i * interval '1 month'))::date
      ) < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END AS effective_status
  FROM agreements a
  CROSS JOIN LATERAL generate_series(0, a.new_installments - 1) AS i
  WHERE a.tenant_id = _tenant
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))
    AND NOT (COALESCE(a.cancelled_installments, '{}'::jsonb) ? cast(i + 1 as text))
    AND COALESCE(
      (a.custom_installment_dates->>cast(i + 1 as text))::date,
      (a.first_due_date::date + (i * interval '1 month'))::date
    ) = _target_date;
END;
$function$;