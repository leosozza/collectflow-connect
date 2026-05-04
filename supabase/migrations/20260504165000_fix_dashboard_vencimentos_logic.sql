
-- =====================================================================
-- FIX: Dashboard Overdue Logic & Payment Resiliency
-- =====================================================================

-- 1. Redefine get_financial_confirmed_payments with better fallbacks
CREATE OR REPLACE FUNCTION public.get_financial_confirmed_payments(
  _tenant_id uuid,
  _date_from date DEFAULT NULL::date,
  _date_to date DEFAULT NULL::date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[],
  _source text[] DEFAULT NULL::text[],
  _agreement_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  source text,
  source_id text,
  tenant_id uuid,
  agreement_id uuid,
  client_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  operator_id uuid,
  installment_key text,
  installment_number integer,
  amount_paid numeric,
  paid_at date,
  paid_at_ts timestamptz,
  payment_method text,
  external_id text,
  raw_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.resolve_financial_tenant(_tenant_id);
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH unified AS (
    SELECT
      'manual'::text AS source,
      mp.id::text AS source_id,
      mp.tenant_id,
      mp.agreement_id,
      NULL::uuid AS client_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      a.created_by AS operator_id,
      mp.installment_key,
      mp.installment_number::integer,
      COALESCE(mp.amount_paid, 0)::numeric AS amount_paid,
      mp.payment_date::date AS paid_at,
      mp.payment_date::timestamptz AS paid_at_ts,
      mp.payment_method::text AS payment_method,
      mp.id::text AS external_id,
      mp.status::text AS raw_status
    FROM public.manual_payments mp
    JOIN public.agreements a
      ON a.id = mp.agreement_id
     AND a.tenant_id = mp.tenant_id
    WHERE mp.tenant_id = v_tenant_id
      AND mp.status IN ('confirmed', 'approved')
      AND mp.payment_date IS NOT NULL

    UNION ALL

    SELECT
      'portal'::text AS source,
      pp.id::text AS source_id,
      pp.tenant_id,
      pp.agreement_id,
      NULL::uuid AS client_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      a.created_by AS operator_id,
      NULL::text AS installment_key,
      NULL::integer AS installment_number,
      COALESCE(pp.amount, 0)::numeric AS amount_paid,
      pp.updated_at::date AS paid_at,
      pp.updated_at::timestamptz AS paid_at_ts,
      pp.payment_method::text AS payment_method,
      pp.negociarie_id_geral::text AS external_id,
      pp.status::text AS raw_status
    FROM public.portal_payments pp
    JOIN public.agreements a
      ON a.id = pp.agreement_id
     AND a.tenant_id = pp.tenant_id
    WHERE pp.tenant_id = v_tenant_id
      AND pp.status = 'paid'
      AND pp.updated_at IS NOT NULL

    UNION ALL

    SELECT
      'negociarie'::text AS source,
      nc.id::text AS source_id,
      nc.tenant_id,
      nc.agreement_id,
      nc.client_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      a.created_by AS operator_id,
      nc.installment_key,
      NULL::integer AS installment_number,
      COALESCE(nc.valor_pago, nc.valor, 0)::numeric AS amount_paid,
      COALESCE(nc.data_pagamento::date, nc.updated_at::date) AS paid_at,
      COALESCE(nc.data_pagamento::timestamptz, nc.updated_at::timestamptz) AS paid_at_ts,
      nc.tipo::text AS payment_method,
      COALESCE(nc.id_geral, nc.id_parcela, nc.id::text)::text AS external_id,
      nc.status::text AS raw_status
    FROM public.negociarie_cobrancas nc
    JOIN public.agreements a
      ON a.id = nc.agreement_id
     AND a.tenant_id = nc.tenant_id
    WHERE nc.tenant_id = v_tenant_id
      AND nc.status = 'pago'
      AND nc.agreement_id IS NOT NULL
  )
  SELECT
    u.source,
    u.source_id,
    u.tenant_id,
    u.agreement_id,
    u.client_id,
    u.client_cpf,
    u.client_name,
    u.credor,
    u.operator_id,
    u.installment_key,
    u.installment_number,
    u.amount_paid,
    u.paid_at,
    u.paid_at_ts,
    u.payment_method,
    u.external_id,
    u.raw_status
  FROM unified u
  WHERE (_date_from IS NULL OR u.paid_at >= _date_from)
    AND (_date_to IS NULL OR u.paid_at <= _date_to)
    AND (_credor IS NULL OR u.credor = ANY(_credor))
    AND (_operator_ids IS NULL OR u.operator_id = ANY(_operator_ids))
    AND (_source IS NULL OR u.source = ANY(_source))
    AND (_agreement_id IS NULL OR u.agreement_id = _agreement_id);
END;
$function$;

-- 2. Redefine get_financial_agreement_installments with 'completed' logic
CREATE OR REPLACE FUNCTION public.get_financial_agreement_installments(
  _tenant_id uuid,
  _date_from date DEFAULT NULL::date,
  _date_to date DEFAULT NULL::date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[],
  _agreement_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  tenant_id uuid,
  agreement_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  operator_id uuid,
  agreement_status text,
  cancellation_type text,
  agreement_created_at timestamptz,
  agreement_updated_at timestamptz,
  installment_key text,
  installment_number integer,
  display_number integer,
  total_installments integer,
  due_date date,
  installment_amount numeric,
  paid_amount numeric,
  effective_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.resolve_financial_tenant(_tenant_id);
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH schedule_all AS (
    SELECT
      a.tenant_id,
      a.id AS agreement_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      a.created_by AS operator_id,
      a.status AS agreement_status,
      a.cancellation_type,
      a.created_at AS agreement_created_at,
      a.updated_at AS agreement_updated_at,
      'entrada'::text AS installment_key,
      0::integer AS installment_number,
      1::integer AS display_number,
      (COALESCE(a.new_installments, 0) + 1)::integer AS total_installments,
      COALESCE(
        (a.custom_installment_dates->>'entrada')::date,
        a.entrada_date,
        a.first_due_date
      )::date AS due_date,
      COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value, 0)::numeric AS installment_amount,
      0::integer AS sort_order
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND COALESCE(a.entrada_value, 0) > 0
      AND NOT (COALESCE(a.cancelled_installments, '{}'::jsonb) ? 'entrada')
      AND (_agreement_id IS NULL OR a.id = _agreement_id)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))

    UNION ALL

    SELECT
      a.tenant_id,
      a.id AS agreement_id,
      a.client_cpf,
      a.client_name,
      a.credor,
      a.created_by AS operator_id,
      a.status AS agreement_status,
      a.cancellation_type,
      a.created_at AS agreement_created_at,
      a.updated_at AS agreement_updated_at,
      gs.i::text AS installment_key,
      gs.i::integer AS installment_number,
      (gs.i + CASE WHEN COALESCE(a.entrada_value, 0) > 0 THEN 1 ELSE 0 END)::integer AS display_number,
      (COALESCE(a.new_installments, 0) + CASE WHEN COALESCE(a.entrada_value, 0) > 0 THEN 1 ELSE 0 END)::integer AS total_installments,
      COALESCE(
        (a.custom_installment_dates->>gs.i::text)::date,
        (a.first_due_date::date + ((gs.i - 1) * interval '1 month'))::date
      )::date AS due_date,
      COALESCE((a.custom_installment_values->>gs.i::text)::numeric, a.new_installment_value, 0)::numeric AS installment_amount,
      gs.i::integer AS sort_order
    FROM public.agreements a
    CROSS JOIN LATERAL generate_series(1, COALESCE(a.new_installments, 0)) AS gs(i)
    WHERE a.tenant_id = v_tenant_id
      AND NOT (COALESCE(a.cancelled_installments, '{}'::jsonb) ? gs.i::text)
      AND (_agreement_id IS NULL OR a.id = _agreement_id)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  paid AS (
    SELECT *
    FROM public.get_financial_confirmed_payments(
      v_tenant_id,
      NULL::date,
      NULL::date,
      _credor,
      _operator_ids,
      NULL::text[],
      _agreement_id
    )
  ),
  with_keyed AS (
    SELECT
      s.*,
      COALESCE((
        SELECT SUM(p.amount_paid)
        FROM paid p
        WHERE p.agreement_id = s.agreement_id
          AND (
            (
              s.installment_number = 0
              AND (
                p.installment_key IN ('entrada', s.agreement_id::text || ':0')
                OR p.installment_number = 0
              )
            )
            OR (
              s.installment_number > 0
              AND (
                p.installment_key IN (s.installment_key, s.agreement_id::text || ':' || s.installment_key)
                OR p.installment_number IN (s.installment_number, s.display_number)
              )
            )
          )
      ), 0)::numeric AS keyed_paid_amount,
      COALESCE((
        SELECT SUM(p.amount_paid)
        FROM paid p
        WHERE p.agreement_id = s.agreement_id
          AND p.installment_key IS NULL
          AND p.installment_number IS NULL
      ), 0)::numeric AS unkeyed_paid_total
    FROM schedule_all s
  ),
  with_open AS (
    SELECT
      wk.*,
      GREATEST(wk.installment_amount - wk.keyed_paid_amount, 0)::numeric AS open_after_keyed
    FROM with_keyed wk
  ),
  balanced AS (
    SELECT
      wo.*,
      COALESCE(
        SUM(wo.open_after_keyed) OVER (
          PARTITION BY wo.agreement_id
          ORDER BY wo.due_date, wo.sort_order
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
        0
      )::numeric AS open_before
    FROM with_open wo
  ),
  final_rows AS (
    SELECT
      b.*,
      LEAST(
        b.installment_amount,
        b.keyed_paid_amount + GREATEST(LEAST(b.unkeyed_paid_total - b.open_before, b.open_after_keyed), 0)
      )::numeric AS computed_paid_amount
    FROM balanced b
  )
  SELECT
    fr.tenant_id,
    fr.agreement_id,
    fr.client_cpf,
    fr.client_name,
    fr.credor,
    fr.operator_id,
    fr.agreement_status,
    fr.cancellation_type,
    fr.agreement_created_at,
    fr.agreement_updated_at,
    fr.installment_key,
    fr.installment_number,
    fr.display_number,
    fr.total_installments,
    fr.due_date,
    fr.installment_amount,
    fr.computed_paid_amount AS paid_amount,
    CASE
      WHEN fr.computed_paid_amount >= fr.installment_amount - 0.01 THEN 'paid'
      WHEN fr.agreement_status = 'completed' THEN 'paid'
      WHEN fr.agreement_status = 'cancelled' THEN 'cancelled'
      WHEN fr.due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END::text AS effective_status
  FROM final_rows fr
  WHERE (_date_from IS NULL OR fr.due_date >= _date_from)
    AND (_date_to IS NULL OR fr.due_date <= _date_to)
  ORDER BY fr.due_date, fr.client_name, fr.display_number;
END;
$function$;

-- 3. Redefine get_dashboard_vencimentos_v2 for cleaner logic
CREATE OR REPLACE FUNCTION public.get_dashboard_vencimentos_v2(
  _tenant_id uuid DEFAULT NULL::uuid,
  _target_date date DEFAULT CURRENT_DATE,
  _user_id uuid DEFAULT NULL::uuid,
  _user_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  agreement_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  numero_parcela integer,
  total_parcelas integer,
  valor_parcela numeric,
  agreement_status text,
  effective_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
  v_operator_ids uuid[];
BEGIN
  v_tenant_id := public.resolve_financial_tenant(_tenant_id);
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  v_operator_ids := CASE
    WHEN _user_ids IS NOT NULL AND array_length(_user_ids, 1) IS NOT NULL THEN _user_ids
    WHEN _user_id IS NOT NULL THEN ARRAY[_user_id]
    ELSE NULL::uuid[]
  END;

  RETURN QUERY
  SELECT
    fi.agreement_id,
    fi.client_cpf,
    fi.client_name,
    fi.credor,
    fi.display_number AS numero_parcela,
    fi.total_installments AS total_parcelas,
    fi.installment_amount AS valor_parcela,
    fi.agreement_status,
    fi.effective_status
  FROM public.get_financial_agreement_installments(
    v_tenant_id,
    _target_date,
    _target_date,
    NULL::text[],
    v_operator_ids,
    NULL::uuid
  ) fi
  WHERE fi.agreement_status NOT IN ('cancelled', 'rejected')
  ORDER BY fi.client_name, fi.display_number;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_financial_confirmed_payments(uuid,date,date,text[],uuid[],text[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_agreement_installments(uuid,date,date,text[],uuid[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_vencimentos_v2(uuid,date,uuid,uuid[]) TO authenticated;
