-- Harden agreement status reconciliation without relying on TEMP TABLE state.
-- Idempotent production migration:
-- - completed remains the only "quitado" agreement status
-- - approved remains an active/vigente agreement status
-- - payment rows and agreement amounts are not changed

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
),
to_complete AS (
  SELECT
    a.id,
    a.tenant_id
  FROM public.agreements a
  JOIN paid_totals pt
    ON pt.tenant_id = a.tenant_id
   AND pt.agreement_id = a.id
  WHERE a.status IN ('pending', 'approved', 'overdue')
    AND COALESCE(a.proposed_total, 0) > 0
    AND COALESCE(pt.total_paid, 0) >= COALESCE(a.proposed_total, 0) - 0.01
)
UPDATE public.agreements a
SET
  status = 'completed',
  updated_at = now()
FROM to_complete tc
WHERE a.id = tc.id
  AND a.tenant_id = tc.tenant_id
  AND a.status <> 'completed';


WITH completed_agreements AS (
  SELECT
    a.id,
    a.tenant_id,
    a.client_cpf,
    a.credor
  FROM public.agreements a
  WHERE a.status = 'completed'
)
UPDATE public.clients c
SET
  status = 'pago',
  data_quitacao = COALESCE(c.data_quitacao, CURRENT_DATE)
FROM completed_agreements ca
WHERE c.tenant_id = ca.tenant_id
  AND c.status IN ('em_acordo', 'pago')
  AND regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g') = regexp_replace(COALESCE(ca.client_cpf, ''), '\D', '', 'g')
  AND lower(btrim(COALESCE(c.credor, ''))) = lower(btrim(COALESCE(ca.credor, '')));
