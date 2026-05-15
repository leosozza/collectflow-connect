CREATE OR REPLACE FUNCTION public.get_baixas_realizadas(_date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date, _credor text DEFAULT NULL::text, _local text DEFAULT NULL::text, _payment_method text DEFAULT NULL::text, _operator_id uuid DEFAULT NULL::uuid, _tenant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(source text, payment_id uuid, agreement_id uuid, client_cpf text, client_name text, credor text, installment_number integer, total_installments integer, installment_key text, valor_original numeric, juros numeric, multa numeric, honorarios numeric, desconto numeric, valor_pago numeric, payment_date date, payment_method text, local_pagamento text, operator_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
BEGIN
  IF _tenant_id IS NOT NULL THEN
    IF NOT public.can_access_tenant(_tenant_id) THEN
      RETURN;
    END IF;
    _tenant := _tenant_id;
  ELSE
    SELECT tenant_id INTO _tenant
      FROM public.tenant_users
      WHERE user_id = auth.uid()
      LIMIT 1;
    IF _tenant IS NULL THEN RETURN; END IF;
  END IF;

  RETURN QUERY
  WITH unified AS (
    SELECT
      'manual'::text AS source,
      mp.id AS payment_id,
      a.id AS agreement_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      mp.installment_number,
      (
        GREATEST(
          1,
          (SELECT COUNT(*)::int FROM jsonb_object_keys(COALESCE(a.custom_installment_values, '{}'::jsonb)) k WHERE k LIKE 'entrada%')
        )
        + COALESCE(a.new_installments, 0)
      )::int AS total_installments,
      mp.installment_key,
      CASE
        WHEN mp.installment_number = 0 THEN COALESCE(
          (a.custom_installment_values->>NULLIF(mp.installment_key,''))::numeric,
          (a.custom_installment_values->>'entrada')::numeric,
          a.entrada_value
        )
        ELSE COALESCE((a.custom_installment_values->>cast(mp.installment_number as text))::numeric, a.new_installment_value)
      END AS valor_original,
      COALESCE(mp.interest_amount, 0)::numeric AS juros,
      COALESCE(mp.penalty_amount, 0)::numeric AS multa,
      COALESCE(mp.fees_amount, 0)::numeric AS honorarios,
      COALESCE(mp.discount_amount, 0)::numeric AS desconto,
      mp.amount_paid AS valor_pago,
      mp.payment_date,
      mp.payment_method,
      CASE
        WHEN LOWER(COALESCE(mp.receiver,'')) IN ('credora','creditor','credor') THEN 'credora'
        ELSE 'cobradora'
      END AS local_pagamento,
      COALESCE(a.created_by, (SELECT user_id FROM profiles WHERE id = mp.requested_by LIMIT 1)) AS operator_id
    FROM manual_payments mp
    JOIN agreements a ON a.id = mp.agreement_id
    WHERE mp.tenant_id = _tenant
      AND mp.status IN ('confirmed','approved')

    UNION ALL

    SELECT
      'portal'::text,
      pp.id,
      a.id,
      a.client_cpf,
      a.client_name,
      a.credor,
      NULL::int,
      (
        GREATEST(
          1,
          (SELECT COUNT(*)::int FROM jsonb_object_keys(COALESCE(a.custom_installment_values, '{}'::jsonb)) k WHERE k LIKE 'entrada%')
        )
        + COALESCE(a.new_installments, 0)
      )::int,
      NULL::text,
      pp.amount AS valor_original,
      COALESCE((pp.payment_data->>'interest')::numeric, (COALESCE(a.interest_amount, 0) / NULLIF(1 + COALESCE(a.new_installments, 0),0))::numeric) AS juros,
      COALESCE((pp.payment_data->>'penalty')::numeric, (COALESCE(a.penalty_amount, 0) / NULLIF(1 + COALESCE(a.new_installments, 0),0))::numeric) AS multa,
      COALESCE((pp.payment_data->>'fees')::numeric, (COALESCE(a.fees_amount, 0) / NULLIF(1 + COALESCE(a.new_installments, 0),0))::numeric) AS honorarios,
      COALESCE((pp.payment_data->>'discount')::numeric, (COALESCE(a.discount_amount, 0) / NULLIF(1 + COALESCE(a.new_installments, 0),0))::numeric) AS desconto,
      pp.amount AS valor_pago,
      pp.updated_at::date,
      pp.payment_method,
      'cobradora'::text,
      a.created_by AS operator_id
    FROM portal_payments pp
    JOIN agreements a ON a.id = pp.agreement_id
    WHERE pp.tenant_id = _tenant
      AND pp.status = 'paid'

    UNION ALL

    SELECT
      'negociarie'::text,
      nc.id,
      a.id,
      a.client_cpf,
      a.client_name,
      a.credor,
      NULL::int,
      (
        GREATEST(
          1,
          (SELECT COUNT(*)::int FROM jsonb_object_keys(COALESCE(a.custom_installment_values, '{}'::jsonb)) k WHERE k LIKE 'entrada%')
        )
        + COALESCE(a.new_installments, 0)
      )::int,
      nc.installment_key,
      nc.valor AS valor_original,
      0::numeric AS juros,
      0::numeric AS multa,
      0::numeric AS honorarios,
      0::numeric AS desconto,
      nc.valor_pago,
      nc.data_pagamento,
      'boleto'::text,
      'cobradora'::text,
      a.created_by AS operator_id
    FROM negociarie_cobrancas nc
    JOIN agreements a ON a.id = nc.agreement_id
    WHERE nc.tenant_id = _tenant
      AND nc.status = 'pago'
  )
  SELECT * FROM unified u
  WHERE (_date_from IS NULL OR u.payment_date >= _date_from)
    AND (_date_to   IS NULL OR u.payment_date <= _date_to)
    AND (_credor    IS NULL OR u.credor = _credor)
    AND (_local     IS NULL OR u.local_pagamento = _local)
    AND (_payment_method IS NULL OR u.payment_method = _payment_method)
    AND (_operator_id IS NULL OR u.operator_id = _operator_id)
  ORDER BY u.payment_date DESC, u.payment_id DESC;
END;
$function$;