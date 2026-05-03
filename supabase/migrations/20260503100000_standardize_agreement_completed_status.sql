-- Standardize RIVO agreement status semantics.
-- approved = acordo aprovado/vigente
-- completed = acordo quitado
--
-- Production-safe scope:
-- - no payment rows are changed
-- - no agreements are blindly migrated from approved to completed
-- - historical status is reconciled only when confirmed payments cover the agreement total

CREATE TEMP TABLE tmp_completed_agreement_reconciliation ON COMMIT DROP AS
WITH payment_rows AS (
  SELECT
    mp.tenant_id,
    mp.agreement_id,
    COALESCE(mp.amount_paid, 0)::numeric AS amount_paid
  FROM public.manual_payments mp
  WHERE mp.agreement_id IS NOT NULL
    AND mp.status IN ('confirmed', 'approved')

  UNION ALL

  SELECT
    pp.tenant_id,
    pp.agreement_id,
    COALESCE(pp.amount, 0)::numeric AS amount_paid
  FROM public.portal_payments pp
  WHERE pp.agreement_id IS NOT NULL
    AND pp.status = 'paid'

  UNION ALL

  SELECT
    nc.tenant_id,
    nc.agreement_id,
    COALESCE(nc.valor_pago, nc.valor, 0)::numeric AS amount_paid
  FROM public.negociarie_cobrancas nc
  WHERE nc.agreement_id IS NOT NULL
    AND nc.status = 'pago'
),
paid_totals AS (
  SELECT
    pr.tenant_id,
    pr.agreement_id,
    SUM(pr.amount_paid)::numeric AS total_paid
  FROM payment_rows pr
  GROUP BY pr.tenant_id, pr.agreement_id
)
SELECT
  a.id,
  a.tenant_id,
  a.client_cpf,
  a.credor,
  a.status AS previous_status,
  COALESCE(a.proposed_total, 0)::numeric AS proposed_total,
  COALESCE(pt.total_paid, 0)::numeric AS total_paid
FROM public.agreements a
JOIN paid_totals pt
  ON pt.tenant_id = a.tenant_id
 AND pt.agreement_id = a.id
WHERE a.status IN ('pending', 'approved', 'overdue')
  AND COALESCE(a.proposed_total, 0) > 0
  AND COALESCE(pt.total_paid, 0) >= COALESCE(a.proposed_total, 0) - 0.01;

UPDATE public.agreements a
SET
  status = 'completed',
  updated_at = now()
FROM tmp_completed_agreement_reconciliation r
WHERE a.id = r.id
  AND a.tenant_id = r.tenant_id
  AND a.status <> 'completed';

UPDATE public.clients c
SET status = 'pago'
FROM tmp_completed_agreement_reconciliation r
WHERE c.tenant_id = r.tenant_id
  AND c.status = 'em_acordo'
  AND regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g') = regexp_replace(COALESCE(r.client_cpf, ''), '\D', '', 'g')
  AND lower(btrim(COALESCE(c.credor, ''))) = lower(btrim(COALESCE(r.credor, '')));


CREATE OR REPLACE FUNCTION public.get_financial_summary(
  _tenant_id uuid,
  _date_from date DEFAULT NULL::date,
  _date_to date DEFAULT NULL::date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  total_negociado numeric,
  total_recebido numeric,
  total_pendente numeric,
  total_quebra numeric,
  qtd_acordos integer,
  qtd_acordos_ativos integer,
  qtd_quebras integer
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
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::integer, 0::integer, 0::integer;
    RETURN;
  END IF;

  RETURN QUERY
  WITH valid_agreements AS (
    SELECT a.id, COALESCE(a.proposed_total, 0)::numeric AS proposed_total, a.status
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND a.status NOT IN ('cancelled', 'rejected')
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to IS NULL OR a.created_at::date <= _date_to)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  broken_agreements AS (
    SELECT a.id, COALESCE(a.proposed_total, 0)::numeric AS proposed_total
    FROM public.agreements a
    WHERE a.tenant_id = v_tenant_id
      AND a.status = 'cancelled'
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to IS NULL OR a.created_at::date <= _date_to)
      AND (_credor IS NULL OR a.credor = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  ),
  received AS (
    SELECT COALESCE(SUM(p.amount_paid), 0)::numeric AS total
    FROM public.get_financial_confirmed_payments(
      v_tenant_id,
      _date_from,
      _date_to,
      _credor,
      _operator_ids,
      NULL::text[],
      NULL::uuid
    ) p
  ),
  totals AS (
    SELECT
      COALESCE((SELECT SUM(va.proposed_total) FROM valid_agreements va), 0)::numeric AS valid_total,
      COALESCE((SELECT COUNT(*) FROM valid_agreements), 0)::integer AS valid_count,
      COALESCE((SELECT COUNT(*) FROM valid_agreements va WHERE va.status IN ('pending', 'approved', 'overdue')), 0)::integer AS active_count,
      COALESCE((SELECT SUM(ba.proposed_total) FROM broken_agreements ba), 0)::numeric AS broken_total,
      COALESCE((SELECT COUNT(*) FROM broken_agreements), 0)::integer AS broken_count,
      (SELECT total FROM received)::numeric AS received_total
  )
  SELECT
    t.valid_total AS total_negociado,
    t.received_total AS total_recebido,
    GREATEST(t.valid_total - t.received_total, 0)::numeric AS total_pendente,
    t.broken_total AS total_quebra,
    t.valid_count AS qtd_acordos,
    t.active_count AS qtd_acordos_ativos,
    t.broken_count AS qtd_quebras
  FROM totals t;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_financial_summary(uuid,date,date,text[],uuid[]) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_bi_revenue_summary(
  _tenant_id uuid,
  _date_from date DEFAULT NULL::date,
  _date_to date DEFAULT NULL::date,
  _credor text[] DEFAULT NULL::text[],
  _operator_ids uuid[] DEFAULT NULL::uuid[],
  _channel text[] DEFAULT NULL::text[],
  _score_min integer DEFAULT NULL::integer,
  _score_max integer DEFAULT NULL::integer
)
RETURNS TABLE(
  total_negociado numeric,
  total_recebido numeric,
  total_pendente numeric,
  total_quebra numeric,
  ticket_medio numeric,
  qtd_acordos integer,
  qtd_acordos_ativos integer,
  qtd_quebras integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH s AS (
    SELECT *
    FROM public.get_financial_summary(_tenant_id, _date_from, _date_to, _credor, _operator_ids)
  )
  SELECT
    s.total_negociado,
    s.total_recebido,
    s.total_pendente,
    s.total_quebra,
    CASE WHEN s.qtd_acordos > 0
      THEN s.total_negociado / s.qtd_acordos
      ELSE 0
    END::numeric AS ticket_medio,
    s.qtd_acordos,
    s.qtd_acordos_ativos,
    s.qtd_quebras
  FROM s;
$function$;

GRANT EXECUTE ON FUNCTION public.get_bi_revenue_summary(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;
