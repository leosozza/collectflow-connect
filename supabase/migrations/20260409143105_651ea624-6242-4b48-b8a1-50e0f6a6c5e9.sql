
CREATE OR REPLACE FUNCTION public.get_agreement_financials(_tenant_id uuid)
RETURNS TABLE(
  agreement_id uuid,
  tenant_id uuid,
  created_by uuid,
  client_cpf text,
  client_name text,
  credor text,
  created_at timestamptz,
  first_due_date date,
  status text,
  original_total numeric,
  proposed_total numeric,
  entrada_value numeric,
  total_paid_real numeric,
  pending_balance_real numeric,
  payment_count bigint,
  first_payment_date date,
  last_payment_date date,
  paid_via_manual numeric,
  paid_via_negociarie numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH manual_totals AS (
    SELECT
      mp.agreement_id AS aid,
      COALESCE(SUM(mp.amount_paid), 0) AS total_manual,
      COUNT(*)::bigint AS cnt,
      MIN(mp.payment_date)::date AS first_date,
      MAX(mp.payment_date)::date AS last_date
    FROM manual_payments mp
    JOIN agreements a2 ON a2.id = mp.agreement_id
    WHERE a2.tenant_id = _tenant_id
      AND mp.status = 'confirmed'
    GROUP BY mp.agreement_id
  ),
  negociarie_totals AS (
    SELECT
      nc.agreement_id AS aid,
      COALESCE(SUM(nc.valor_pago), 0) AS total_neg,
      COUNT(*)::bigint AS cnt,
      MIN(nc.data_pagamento)::date AS first_date,
      MAX(nc.data_pagamento)::date AS last_date
    FROM negociarie_cobrancas nc
    JOIN agreements a3 ON a3.id = nc.agreement_id
    WHERE a3.tenant_id = _tenant_id
      AND nc.status = 'pago'
    GROUP BY nc.agreement_id
  )
  SELECT
    a.id AS agreement_id,
    a.tenant_id,
    a.created_by::uuid,
    a.client_cpf,
    a.client_name,
    a.credor,
    a.created_at,
    a.first_due_date::date,
    a.status,
    a.original_total,
    a.proposed_total,
    COALESCE(a.entrada_value, 0) AS entrada_value,
    (COALESCE(mt.total_manual, 0) + COALESCE(nt.total_neg, 0))::numeric AS total_paid_real,
    GREATEST(a.proposed_total - (COALESCE(mt.total_manual, 0) + COALESCE(nt.total_neg, 0)), 0)::numeric AS pending_balance_real,
    (COALESCE(mt.cnt, 0) + COALESCE(nt.cnt, 0))::bigint AS payment_count,
    LEAST(mt.first_date, nt.first_date) AS first_payment_date,
    GREATEST(mt.last_date, nt.last_date) AS last_payment_date,
    COALESCE(mt.total_manual, 0)::numeric AS paid_via_manual,
    COALESCE(nt.total_neg, 0)::numeric AS paid_via_negociarie
  FROM agreements a
  LEFT JOIN manual_totals mt ON mt.aid = a.id
  LEFT JOIN negociarie_totals nt ON nt.aid = a.id
  WHERE a.tenant_id = _tenant_id;
END;
$function$;
