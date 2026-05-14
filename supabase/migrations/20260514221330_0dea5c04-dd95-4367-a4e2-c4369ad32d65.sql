-- =====================================================================
-- CRÍTICO 1: get_financial_received_by_day passa a usar a UNION SSOT
-- (manual_payments + portal_payments + negociarie_cobrancas), igualando
-- o gráfico ao headline "Recebido em R$" e à aba Baixas Realizadas.
-- Assinatura mantida 100% compatível com o frontend.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_financial_received_by_day(
  _tenant_id uuid,
  _date_from date,
  _date_to date,
  _operator_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(payment_date date, total_recebido numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH unified AS (
    SELECT
      mp.payment_date AS dt,
      mp.amount_paid::numeric AS valor,
      a.created_by AS op
    FROM public.manual_payments mp
    JOIN public.agreements a ON a.id = mp.agreement_id
    WHERE mp.tenant_id = _tenant_id
      AND mp.status IN ('confirmed','approved')
      AND mp.payment_date BETWEEN _date_from AND _date_to

    UNION ALL

    SELECT
      pp.updated_at::date AS dt,
      pp.amount::numeric AS valor,
      a.created_by AS op
    FROM public.portal_payments pp
    JOIN public.agreements a ON a.id = pp.agreement_id
    WHERE pp.tenant_id = _tenant_id
      AND pp.status = 'paid'
      AND pp.updated_at::date BETWEEN _date_from AND _date_to

    UNION ALL

    SELECT
      nc.data_pagamento AS dt,
      nc.valor_pago::numeric AS valor,
      a.created_by AS op
    FROM public.negociarie_cobrancas nc
    JOIN public.agreements a ON a.id = nc.agreement_id
    WHERE nc.tenant_id = _tenant_id
      AND nc.status = 'pago'
      AND nc.data_pagamento BETWEEN _date_from AND _date_to
  )
  SELECT
    dt AS payment_date,
    SUM(valor)::numeric AS total_recebido
  FROM unified
  WHERE public.can_access_tenant(_tenant_id)
    AND (
      _operator_ids IS NULL
      OR array_length(_operator_ids, 1) IS NULL
      OR op = ANY(_operator_ids)
    )
  GROUP BY dt
  ORDER BY dt;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_received_by_day(uuid, date, date, uuid[]) TO authenticated;

-- =====================================================================
-- CRÍTICO 2: get_baixas_realizadas aceita _tenant_id opcional e valida
-- via can_access_tenant, suportando Super Admin Support Mode.
-- Quando _tenant_id é NULL, mantém comportamento legado (auth.uid →
-- tenant_users), preservando todos os call-sites atuais.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_baixas_realizadas(
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _credor text DEFAULT NULL,
  _local text DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _operator_id uuid DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL
)
RETURNS TABLE(
  source text, payment_id uuid, agreement_id uuid, client_cpf text,
  client_name text, credor text, installment_number integer,
  total_installments integer, installment_key text, valor_original numeric,
  juros numeric, multa numeric, honorarios numeric, desconto numeric,
  valor_pago numeric, payment_date date, payment_method text,
  local_pagamento text, operator_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
BEGIN
  -- Resolve tenant: explícito (super admin support) ou via tenant_users.
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
      COALESCE(nc.juros, 0)::numeric,
      COALESCE(nc.multa, 0)::numeric,
      COALESCE(nc.honorarios, 0)::numeric,
      COALESCE(nc.desconto, 0)::numeric,
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

GRANT EXECUTE ON FUNCTION public.get_baixas_realizadas(date, date, text, text, text, uuid, uuid) TO authenticated;