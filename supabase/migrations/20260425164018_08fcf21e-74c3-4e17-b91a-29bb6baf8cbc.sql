ALTER TABLE public.agreements
  ADD COLUMN IF NOT EXISTS interest_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fees_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installment_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.manual_payments
  ADD COLUMN IF NOT EXISTS interest_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fees_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.get_baixas_realizadas(date, date, text, text, text);

CREATE OR REPLACE FUNCTION public.get_baixas_realizadas(
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
  installment_number int,
  total_installments int,
  installment_key text,
  valor_original numeric,
  juros numeric,
  multa numeric,
  honorarios numeric,
  desconto numeric,
  valor_pago numeric,
  payment_date date,
  payment_method text,
  local_pagamento text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    CASE WHEN COALESCE(mp.receiver,'') IN ('credora','creditor') THEN 'credora' ELSE 'cobradora' END
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
    NULL::int,
    a.new_installments::int,
    NULL::text,
    pp.amount,
    COALESCE((pp.payment_data->>'juros')::numeric, 0),
    COALESCE((pp.payment_data->>'multa')::numeric, 0),
    COALESCE((pp.payment_data->>'honorarios')::numeric, 0),
    COALESCE((pp.payment_data->>'desconto')::numeric, 0),
    pp.amount,
    pp.updated_at::date,
    pp.payment_method,
    'cobradora'::text
  FROM public.portal_payments pp
  JOIN public.agreements a ON a.id = pp.agreement_id
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
    NULL::int,
    a.new_installments::int,
    nc.installment_key,
    nc.valor_pago,
    0::numeric, 0::numeric, 0::numeric, 0::numeric,
    nc.valor_pago,
    nc.data_pagamento,
    NULL::text,
    'cobradora'::text
  FROM public.negociarie_cobrancas nc
  JOIN public.agreements a ON a.id = nc.agreement_id
  WHERE nc.tenant_id = _tenant
    AND nc.status = 'pago'
    AND (_date_from IS NULL OR nc.data_pagamento >= _date_from)
    AND (_date_to   IS NULL OR nc.data_pagamento <= _date_to)
    AND (_credor IS NULL OR a.credor = _credor)
    AND (_local IS NULL OR _local = 'cobradora');
END;
$$;