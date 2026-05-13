-- ========================================================================
-- Phase 1 finalization: idempotency UNIQUE on source tables
-- ========================================================================

-- Step 1: Mark stale "registrado" siblings as "substituido" where SSOT already
-- locked onto the paid version. SSOT (paid_source_id) was inspected manually:
--   362d56a2:1 → SSOT uses a55ba43f (pago) → mark a7c79a81 substituido
--   43aa1e92:1 → SSOT uses 2e4575ba (pago) → mark 1732a710 substituido
UPDATE public.negociarie_cobrancas SET status = 'substituido', updated_at = now()
WHERE id IN (
  'a7c79a81-88a5-4000-b091-d21d169749fd',
  '1732a710-1ea3-4b28-a5fd-9dfb0c5e2947'
);

-- Step 2: Pure double-click duplicates (registrado+registrado, both zero, ~1s apart).
-- Keep the older one (anti-leak/SSOT lookup also picks oldest); mark the younger as substituido.
UPDATE public.negociarie_cobrancas SET status = 'substituido', updated_at = now()
WHERE id IN (
  '16a4f384-13c9-437f-9870-9d40daffe26e',  -- db7f6afb:2
  '998709fb-ebcc-4d3a-9fa9-dd41dbdfa822',  -- e9d8a9ab:1
  'f45330c8-a991-450e-960e-423df4b1d3d5'   -- f512db2f:1
);

-- Step 3: pago+pago real case (cb8fee4f:entrada). SSOT uses a77456ee (R$ 232,70).
-- The other pago row (R$ 257,60) is a real but mistagged payment — preserve money,
-- detach installment_key. Operator can re-link later via the UI if needed.
UPDATE public.negociarie_cobrancas
SET installment_key = NULL, updated_at = now()
WHERE id = '82b3d6e5-5f5f-4c42-a3b4-7a40a85873b3'
  AND installment_key = 'cb8fee4f-90d4-46d0-9f23-bb84c7fee827:entrada';

-- Step 4: Validate active duplicates are gone before adding constraint
DO $$
DECLARE
  v_dup_mp int;
  v_dup_nc int;
BEGIN
  SELECT COUNT(*) INTO v_dup_mp FROM (
    SELECT 1 FROM public.manual_payments
    WHERE installment_key IS NOT NULL
      AND status IN ('confirmed','approved','pending_confirmation')
    GROUP BY agreement_id, installment_key HAVING COUNT(*) > 1
  ) x;
  SELECT COUNT(*) INTO v_dup_nc FROM (
    SELECT 1 FROM public.negociarie_cobrancas
    WHERE installment_key IS NOT NULL
      AND status IN ('registrado','pago','pendente','RECEIVED','CONFIRMED')
    GROUP BY agreement_id, installment_key HAVING COUNT(*) > 1
  ) x;
  IF v_dup_mp > 0 THEN RAISE EXCEPTION 'manual_payments still has % active dup pairs', v_dup_mp; END IF;
  IF v_dup_nc > 0 THEN RAISE EXCEPTION 'negociarie_cobrancas still has % active dup pairs', v_dup_nc; END IF;
END $$;

-- Step 5: UNIQUE parcial em manual_payments
CREATE UNIQUE INDEX IF NOT EXISTS uq_manual_payments_agreement_inst_active
ON public.manual_payments (agreement_id, installment_key)
WHERE installment_key IS NOT NULL
  AND status IN ('confirmed','approved','pending_confirmation');

-- Step 6: UNIQUE parcial em negociarie_cobrancas (somente status ativos)
-- substituido/cancelado representam histórico legítimo e ficam fora.
CREATE UNIQUE INDEX IF NOT EXISTS uq_negociarie_cob_agreement_inst_active
ON public.negociarie_cobrancas (agreement_id, installment_key)
WHERE installment_key IS NOT NULL
  AND status IN ('registrado','pago','pendente','RECEIVED','CONFIRMED');