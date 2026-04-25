DROP FUNCTION IF EXISTS public.get_baixas_realizadas(date, date, text, text, text);

CREATE FUNCTION public.get_baixas_realizadas(
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _credor text DEFAULT NULL,
  _local text DEFAULT NULL,
  _payment_method text DEFAULT NULL
)
RETURNS TABLE (
  source text,
  payment_id uuid,
  agreement_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  installment_number integer,
  total_installments integer,
  installment_key text,
  valor_original numeric,
  juros numeric,
  multa numeric,
  honorarios numeric,
  desconto numeric,
  valor_pago numeric,
  payment_date date,
  payment_method text,
  local_pagamento text,
  operator_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    'manual'::text,
    mp.id,
    a.id,
    a.client_cpf,
    a.client_name,
    a.credor,
    mp.installment_number::int,
    a.new_installments::int,
    mp.installment_key,
    COALESCE(NULLIF((a.custom_installment_values ->> mp.installment_number::text)::numeric, 0), a.new_installment_value),
    COALESCE(mp.interest_amount, 0),
    COALESCE(mp.penalty_amount, 0),
    COALESCE(mp.fees_amount, 0),
    COALESCE(mp.discount_amount, 0),
    mp.amount_paid,
    mp.payment_date,
    mp.payment_method,
    CASE WHEN COALESCE(mp.receiver,'') IN ('credora','creditor') THEN 'credora' ELSE 'cobradora' END,
    mp.requested_by
  FROM public.manual_payments mp
  JOIN public.agreements a ON a.id = mp.agreement_id
  WHERE mp.tenant_id = _tenant
    AND mp.status IN ('confirmed','approved')
    AND (_date_from IS NULL OR mp.payment_date >= _date_from)
    AND (_date_to   IS NULL OR mp.payment_date <= _date_to)
    AND (_credor IS NULL OR a.credor = _credor)
    AND (_payment_method IS NULL OR mp.payment_method = _payment_method)
    AND (_local IS NULL
         OR (_local = 'credora'  AND COALESCE(mp.receiver,'') IN ('credora','creditor'))
         OR (_local = 'cobradora' AND COALESCE(mp.receiver,'') NOT IN ('credora','creditor')))

  UNION ALL
  SELECT
    'portal'::text,
    pp.id,
    a.id,
    a.client_cpf,
    a.client_name,
    a.credor,
    gs::int,
    a.new_installments::int,
    NULL::text,
    a.new_installment_value,
    ROUND(COALESCE((pp.payment_data->>'juros')::numeric, 0)      / GREATEST(a.new_installments, 1), 2),
    ROUND(COALESCE((pp.payment_data->>'multa')::numeric, 0)      / GREATEST(a.new_installments, 1), 2),
    ROUND(COALESCE((pp.payment_data->>'honorarios')::numeric, 0) / GREATEST(a.new_installments, 1), 2),
    ROUND(COALESCE((pp.payment_data->>'desconto')::numeric, 0)   / GREATEST(a.new_installments, 1), 2),
    ROUND(pp.amount / GREATEST(a.new_installments, 1), 2),
    pp.updated_at::date,
    pp.payment_method,
    'cobradora'::text,
    NULL::uuid
  FROM public.portal_payments pp
  JOIN public.agreements a ON a.id = pp.agreement_id
  CROSS JOIN LATERAL generate_series(1, GREATEST(a.new_installments, 1)) AS gs
  WHERE pp.tenant_id = _tenant
    AND pp.status = 'paid'
    AND (_date_from IS NULL OR pp.updated_at::date >= _date_from)
    AND (_date_to   IS NULL OR pp.updated_at::date <= _date_to)
    AND (_credor IS NULL OR a.credor = _credor)
    AND (_payment_method IS NULL OR pp.payment_method = _payment_method)
    AND (_local IS NULL OR _local = 'cobradora')

  UNION ALL
  SELECT
    'negociarie'::text,
    nc.id,
    a.id,
    a.client_cpf,
    a.client_name,
    a.credor,
    CASE
      WHEN nc.installment_key ~ '^[0-9]+$' THEN nc.installment_key::int
      WHEN nc.installment_key ILIKE 'entrada%' THEN 0
      ELSE NULL
    END,
    a.new_installments::int,
    nc.installment_key,
    a.new_installment_value,
    0::numeric, 0::numeric, 0::numeric, 0::numeric,
    nc.valor_pago,
    nc.data_pagamento,
    NULL::text,
    'cobradora'::text,
    NULL::uuid
  FROM public.negociarie_cobrancas nc
  JOIN public.agreements a ON a.id = nc.agreement_id
  WHERE nc.tenant_id = _tenant
    AND nc.status = 'pago'
    AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
    AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
    AND (_credor IS NULL OR a.credor = _credor)
    AND (_local IS NULL OR _local = 'cobradora');
END;
$function$;