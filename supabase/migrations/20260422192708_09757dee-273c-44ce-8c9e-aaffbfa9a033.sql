-- Round 3 cleanup: 4 duplicatas com mistura NULL ↔ chave canônica

-- 1) Marcar as 4 baixas mais antigas como superseded
UPDATE public.manual_payments
SET status = 'superseded',
    review_notes = COALESCE(review_notes, '') || ' | Substituída por baixa posterior — duplicidade NULL/key (round 3)',
    reviewed_at = COALESCE(reviewed_at, now())
WHERE id IN (
  'dede2e2a-8451-4e79-92df-911003f2cfe0',
  '6328fb9b-ce42-4096-a243-476a7bc531f5',
  'a7afd689-b2ea-4758-8cfb-820c30820ea5',
  'f2e424c6-754a-40fa-9fa7-6f37f3f502c3'
)
AND status = 'confirmed';

-- 2) Reverter clients.valor_pago do excedente por (cpf, credor, tenant)
WITH superseded AS (
  SELECT mp.id, mp.amount_paid, a.client_cpf, a.credor, a.tenant_id
  FROM public.manual_payments mp
  JOIN public.agreements a ON a.id = mp.agreement_id
  WHERE mp.id IN (
    'dede2e2a-8451-4e79-92df-911003f2cfe0',
    '6328fb9b-ce42-4096-a243-476a7bc531f5',
    'a7afd689-b2ea-4758-8cfb-820c30820ea5',
    'f2e424c6-754a-40fa-9fa7-6f37f3f502c3'
  )
), agg AS (
  SELECT client_cpf, credor, tenant_id, SUM(amount_paid) AS revert
  FROM superseded
  GROUP BY client_cpf, credor, tenant_id
)
UPDATE public.clients c
SET valor_pago = GREATEST(0, COALESCE(c.valor_pago, 0) - agg.revert)
FROM agg
WHERE c.cpf = agg.client_cpf
  AND c.credor = agg.credor
  AND c.tenant_id = agg.tenant_id;

-- 3) Re-avaliar agreements.status: se total pago real ficou abaixo do proposed_total → voltar de completed para approved
WITH affected AS (
  SELECT DISTINCT agreement_id
  FROM public.manual_payments
  WHERE id IN (
    'dede2e2a-8451-4e79-92df-911003f2cfe0',
    '6328fb9b-ce42-4096-a243-476a7bc531f5',
    'a7afd689-b2ea-4758-8cfb-820c30820ea5',
    'f2e424c6-754a-40fa-9fa7-6f37f3f502c3'
  )
), totals AS (
  SELECT a.id, a.proposed_total, a.status,
    COALESCE((SELECT SUM(amount_paid) FROM public.manual_payments WHERE agreement_id = a.id AND status = 'confirmed'), 0) AS manual_total,
    COALESCE((SELECT SUM(valor_pago) FROM public.negociarie_cobrancas WHERE agreement_id = a.id AND status = 'pago'), 0) AS cob_total
  FROM public.agreements a
  WHERE a.id IN (SELECT agreement_id FROM affected)
)
UPDATE public.agreements a
SET status = 'approved'
FROM totals t
WHERE a.id = t.id
  AND a.status = 'completed'
  AND (t.manual_total + t.cob_total) < (t.proposed_total - 0.01);

-- 4) Sincronizar custom_installment_values com a baixa que ficou (especialmente Ezi entrada 144,42)
-- Ezi (e66340e7) entrada → 144,42 (NULL key, mais recente)
UPDATE public.agreements
SET custom_installment_values = COALESCE(custom_installment_values, '{}'::jsonb) || jsonb_build_object('entrada', 144.42),
    entrada_value = 144.42
WHERE id = 'e66340e7-ad31-42d6-ab9a-1224b98e8d8c';

-- Ezi (e66340e7) parcela 2 → 136,36 (NULL key, mais recente — mesmo valor, garantir presença)
UPDATE public.agreements
SET custom_installment_values = COALESCE(custom_installment_values, '{}'::jsonb) || jsonb_build_object('2', 136.36)
WHERE id = 'e66340e7-ad31-42d6-ab9a-1224b98e8d8c';

-- Natani (715e16a3) entrada → 118,64 (mesmo valor, garantir)
UPDATE public.agreements
SET custom_installment_values = COALESCE(custom_installment_values, '{}'::jsonb) || jsonb_build_object('entrada', 118.64)
WHERE id = '715e16a3-abc9-4a97-a348-c0bb0ac7e5d1';

-- c888ddf6 parcela 1 → 466,00 (mesmo valor, garantir)
UPDATE public.agreements
SET custom_installment_values = COALESCE(custom_installment_values, '{}'::jsonb) || jsonb_build_object('1', 466.00)
WHERE id = 'c888ddf6-155f-4c3f-80b3-30fcb3dfbdcd';

-- 5) Audit log em client_events
INSERT INTO public.client_events (tenant_id, client_cpf, event_type, event_source, event_value, metadata)
SELECT a.tenant_id, a.client_cpf, 'manual_payment_superseded', 'system', 'cleanup_round_3',
  jsonb_build_object(
    'manual_payment_id', mp.id,
    'agreement_id', mp.agreement_id,
    'amount_reverted', mp.amount_paid,
    'installment_number', mp.installment_number,
    'installment_key', mp.installment_key,
    'reason', 'Duplicidade NULL/chave canônica detectada em auditoria round 3'
  )
FROM public.manual_payments mp
JOIN public.agreements a ON a.id = mp.agreement_id
WHERE mp.id IN (
  'dede2e2a-8451-4e79-92df-911003f2cfe0',
  '6328fb9b-ce42-4096-a243-476a7bc531f5',
  'a7afd689-b2ea-4758-8cfb-820c30820ea5',
  'f2e424c6-754a-40fa-9fa7-6f37f3f502c3'
)
AND mp.status = 'superseded';