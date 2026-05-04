-- Keep collection-rule agreement reminders aligned with the financial source of truth.
-- Confirmed payments from manual_payments, portal_payments, and negociarie_cobrancas
-- are considered before a parcel is selected as eligible for a reminder.

CREATE OR REPLACE FUNCTION public.get_rule_eligible_targets(
  p_rule_id uuid,
  p_target_date date
)
RETURNS TABLE(
  source text,
  client_id uuid,
  cpf text,
  nome_completo text,
  phone text,
  email text,
  credor text,
  valor numeric,
  data_vencimento date,
  agreement_id uuid,
  installment_key text,
  installment_number int,
  total_installments int,
  installment_value numeric,
  installment_due_date date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rule record;
  _credor_name text;
BEGIN
  SELECT cr.* INTO _rule
  FROM public.collection_rules cr
  WHERE cr.id = p_rule_id
    AND cr.is_active = true;

  IF _rule IS NULL THEN
    RETURN;
  END IF;

  IF _rule.credor_id IS NOT NULL THEN
    SELECT razao_social INTO _credor_name
    FROM public.credores
    WHERE id = _rule.credor_id;
  END IF;

  IF _rule.rule_type = 'wallet' THEN
    RETURN QUERY
    SELECT
      'wallet'::text AS source,
      c.id AS client_id,
      c.cpf,
      c.nome_completo,
      c.phone,
      c.email,
      c.credor,
      c.valor_parcela AS valor,
      c.data_vencimento,
      NULL::uuid AS agreement_id,
      NULL::text AS installment_key,
      NULL::int AS installment_number,
      NULL::int AS total_installments,
      NULL::numeric AS installment_value,
      NULL::date AS installment_due_date
    FROM public.clients c
    WHERE c.tenant_id = _rule.tenant_id
      AND (_credor_name IS NULL OR c.credor = _credor_name)
      AND c.data_vencimento = p_target_date
      AND c.status IN ('pendente', 'vencido')
      AND NOT EXISTS (
        SELECT 1
        FROM public.agreements a
        WHERE a.tenant_id = _rule.tenant_id
          AND a.status IN ('pending', 'approved', 'overdue')
          AND regexp_replace(COALESCE(a.client_cpf, ''), '\D', '', 'g') = regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g')
          AND (_credor_name IS NULL OR a.credor = _credor_name)
      );

  ELSIF _rule.rule_type = 'agreement' THEN
    RETURN QUERY
    WITH active_agreements AS (
      SELECT a.*
      FROM public.agreements a
      WHERE a.tenant_id = _rule.tenant_id
        AND a.status IN ('pending', 'approved', 'overdue')
        AND (_credor_name IS NULL OR a.credor = _credor_name)
    ),
    schedule_all AS (
      SELECT
        a.tenant_id,
        a.id AS agreement_id,
        a.client_cpf,
        a.client_name,
        a.credor,
        a.status AS agreement_status,
        'entrada'::text AS installment_key,
        0::integer AS installment_number,
        1::integer AS display_number,
        COALESCE(a.new_installments, 0)::integer AS total_installments,
        COALESCE(
          (a.custom_installment_dates->>'entrada')::date,
          a.entrada_date,
          a.first_due_date
        )::date AS due_date,
        COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value, 0)::numeric AS installment_value,
        0::integer AS sort_order
      FROM active_agreements a
      WHERE COALESCE(a.entrada_value, 0) > 0
        AND NOT (COALESCE(a.cancelled_installments, '{}'::jsonb) ? 'entrada')

      UNION ALL

      SELECT
        a.tenant_id,
        a.id AS agreement_id,
        a.client_cpf,
        a.client_name,
        a.credor,
        a.status AS agreement_status,
        gs.i::text AS installment_key,
        gs.i::integer AS installment_number,
        (gs.i + CASE WHEN COALESCE(a.entrada_value, 0) > 0 THEN 1 ELSE 0 END)::integer AS display_number,
        COALESCE(a.new_installments, 0)::integer AS total_installments,
        COALESCE(
          (a.custom_installment_dates->>gs.i::text)::date,
          (a.first_due_date::date + ((gs.i - 1) * interval '1 month'))::date
        )::date AS due_date,
        COALESCE((a.custom_installment_values->>gs.i::text)::numeric, a.new_installment_value, 0)::numeric AS installment_value,
        gs.i::integer AS sort_order
      FROM active_agreements a
      CROSS JOIN LATERAL generate_series(1, COALESCE(a.new_installments, 0)) AS gs(i)
      WHERE NOT (COALESCE(a.cancelled_installments, '{}'::jsonb) ? gs.i::text)
    ),
    paid AS (
      SELECT
        mp.tenant_id,
        mp.agreement_id,
        mp.installment_key,
        mp.installment_number::integer AS installment_number,
        COALESCE(mp.amount_paid, 0)::numeric AS amount_paid
      FROM public.manual_payments mp
      WHERE mp.tenant_id = _rule.tenant_id
        AND mp.status IN ('confirmed', 'approved')

      UNION ALL

      SELECT
        pp.tenant_id,
        pp.agreement_id,
        NULL::text AS installment_key,
        NULL::integer AS installment_number,
        COALESCE(pp.amount, 0)::numeric AS amount_paid
      FROM public.portal_payments pp
      WHERE pp.tenant_id = _rule.tenant_id
        AND pp.status = 'paid'

      UNION ALL

      SELECT
        nc.tenant_id,
        nc.agreement_id,
        nc.installment_key,
        NULL::integer AS installment_number,
        COALESCE(nc.valor_pago, nc.valor, 0)::numeric AS amount_paid
      FROM public.negociarie_cobrancas nc
      WHERE nc.tenant_id = _rule.tenant_id
        AND nc.status = 'pago'
        AND nc.agreement_id IS NOT NULL
    ),
    with_paid AS (
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
        wp.*,
        GREATEST(wp.installment_value - wp.keyed_paid_amount, 0)::numeric AS open_after_keyed
      FROM with_paid wp
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
          b.installment_value,
          b.keyed_paid_amount + GREATEST(LEAST(b.unkeyed_paid_total - b.open_before, b.open_after_keyed), 0)
        )::numeric AS paid_amount
      FROM balanced b
    ),
    eligible AS (
      SELECT *
      FROM final_rows
      WHERE due_date = p_target_date
        AND installment_value > 0
        AND paid_amount < installment_value - 0.01
    )
    SELECT
      'agreement'::text AS source,
      cl.id AS client_id,
      e.client_cpf AS cpf,
      COALESCE(cl.nome_completo, e.client_name) AS nome_completo,
      cl.phone,
      cl.email,
      e.credor,
      e.installment_value AS valor,
      e.due_date AS data_vencimento,
      e.agreement_id,
      e.installment_key,
      e.installment_number,
      e.total_installments,
      e.installment_value,
      e.due_date AS installment_due_date
    FROM eligible e
    LEFT JOIN LATERAL (
      SELECT id, nome_completo, phone, email
      FROM public.clients
      WHERE tenant_id = _rule.tenant_id
        AND regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = regexp_replace(COALESCE(e.client_cpf, ''), '\D', '', 'g')
        AND credor = e.credor
      ORDER BY data_vencimento ASC
      LIMIT 1
    ) cl ON true;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_rule_eligible_targets(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rule_eligible_targets(uuid,date) TO service_role;
