
ALTER TABLE public.agreement_installments
  ADD COLUMN IF NOT EXISTS paid_after_break BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.negociarie_cobrancas
  ADD COLUMN IF NOT EXISTS superseded BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.payment_orphans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual','negociarie','portal')),
  source_ref_id UUID,
  agreement_id UUID,
  amount NUMERIC,
  paid_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_orphans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_payment_orphans" ON public.payment_orphans;
CREATE POLICY "tenant_select_payment_orphans" ON public.payment_orphans
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "tenant_update_payment_orphans" ON public.payment_orphans;
CREATE POLICY "tenant_update_payment_orphans" ON public.payment_orphans
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_payment_orphans_tenant_unresolved
  ON public.payment_orphans (tenant_id, created_at DESC)
  WHERE resolved_at IS NULL;

-- =========================================================================
-- 2. REBUILD: aceita qualquer valor pago + detecta paid_after_break
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rebuild_agreement_installments(p_agreement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ag                public.agreements%ROWTYPE;
  v_custom_dates     jsonb;
  v_custom_values    jsonb;
  v_cancelled        jsonb;
  v_entrada_keys     text[];
  v_entrada_count    int := 0;
  v_has_entrada      boolean := false;
  v_key              text;
  v_due              date;
  v_amount           numeric;
  v_seq              int;
  v_idx              int;
  v_is_cancelled     boolean;
  v_used             uuid[] := ARRAY[]::uuid[];
  v_inst_id          uuid;
  v_inst_key         text;
  v_inst_seq         int;
  v_inst_is_entrada  boolean;
  v_inst_due         date;
  v_inst_amount      numeric;
  v_canon_key        text;
  v_legacy_key       text;
  v_paid             boolean;
  v_paid_at          timestamptz;
  v_paid_amount      numeric;
  v_paid_source      text;
  v_paid_source_id   uuid;
  v_pending          boolean;
  v_mp_pending       boolean;
  v_mp_total         numeric;
  v_mp_last          date;
  v_mp_id            uuid;
  v_mp_count         int;
  v_canon_inst_num   int;
  v_display_num      int;
  v_cob_id           uuid;
  v_cob_pay_date     date;
  v_cob_amount       numeric;
  v_paid_after_break boolean;
  v_ag_broken        boolean;
BEGIN
  SELECT * INTO v_ag FROM public.agreements WHERE id = p_agreement_id;
  IF NOT FOUND THEN
    DELETE FROM public.agreement_installments WHERE agreement_id = p_agreement_id;
    RETURN;
  END IF;

  v_custom_dates  := COALESCE(v_ag.custom_installment_dates, '{}'::jsonb);
  v_custom_values := COALESCE(v_ag.custom_installment_values, '{}'::jsonb);
  v_cancelled     := COALESCE(v_ag.cancelled_installments, '{}'::jsonb);
  v_ag_broken     := v_ag.status IN ('cancelled','broken');

  DELETE FROM public.agreement_installments WHERE agreement_id = p_agreement_id;

  IF COALESCE(v_ag.entrada_value, 0) > 0 THEN
    SELECT array_agg(k ORDER BY
      CASE WHEN k = 'entrada' THEN 1
           ELSE COALESCE(NULLIF(substring(k FROM 'entrada_(\d+)'), '')::int, 9999)
      END
    )
    INTO v_entrada_keys
    FROM jsonb_object_keys(v_custom_values) AS k
    WHERE k = 'entrada' OR k ~ '^entrada_\d+$';

    IF v_entrada_keys IS NULL OR array_length(v_entrada_keys, 1) IS NULL THEN
      v_entrada_keys := ARRAY['entrada'];
    END IF;
    v_has_entrada := true;
    v_entrada_count := array_length(v_entrada_keys, 1);
  END IF;

  v_seq := 0;

  IF v_has_entrada THEN
    FOREACH v_key IN ARRAY v_entrada_keys LOOP
      v_due := COALESCE((v_custom_dates ->> v_key)::date, v_ag.entrada_date, v_ag.first_due_date);
      v_amount := COALESCE((v_custom_values ->> v_key)::numeric, v_ag.entrada_value, 0);
      v_is_cancelled := v_cancelled ? v_key;
      INSERT INTO public.agreement_installments
        (tenant_id, agreement_id, installment_key, seq, is_entrada, due_date, amount, cancelled)
      VALUES (v_ag.tenant_id, v_ag.id, v_key, v_seq, true, v_due, v_amount, v_is_cancelled);
      v_seq := v_seq + 1;
    END LOOP;
  END IF;

  FOR v_idx IN 0 .. COALESCE(v_ag.new_installments, 0) - 1 LOOP
    v_key := (v_idx + 1)::text;
    v_due := COALESCE(
      (v_custom_dates ->> v_key)::date,
      (v_ag.first_due_date + (v_idx || ' months')::interval)::date
    );
    v_amount := COALESCE((v_custom_values ->> v_key)::numeric, v_ag.new_installment_value, 0);
    v_is_cancelled := v_cancelled ? v_key;
    INSERT INTO public.agreement_installments
      (tenant_id, agreement_id, installment_key, seq, is_entrada, due_date, amount, cancelled)
    VALUES (v_ag.tenant_id, v_ag.id, v_key, v_seq, false, v_due, v_amount, v_is_cancelled);
    v_seq := v_seq + 1;
  END LOOP;

  FOR v_inst_id, v_inst_key, v_inst_seq, v_inst_is_entrada, v_inst_due, v_inst_amount IN
    SELECT id, installment_key, seq, is_entrada, due_date, amount
    FROM public.agreement_installments
    WHERE agreement_id = p_agreement_id
    ORDER BY seq
  LOOP
    v_paid := false;
    v_paid_at := NULL;
    v_paid_amount := NULL;
    v_paid_source := NULL;
    v_paid_source_id := NULL;
    v_pending := false;
    v_paid_after_break := false;

    v_canon_inst_num := CASE
      WHEN v_inst_is_entrada THEN 0
      ELSE (v_inst_seq - v_entrada_count + 1)
    END;
    v_display_num := CASE
      WHEN v_inst_is_entrada THEN 0
      ELSE (CASE WHEN v_has_entrada THEN 1 ELSE 0 END) + v_canon_inst_num
    END;

    SELECT
      bool_or(status = 'pending_confirmation'),
      SUM(CASE WHEN status IN ('confirmed','approved') THEN COALESCE(amount_paid, 0) ELSE 0 END),
      MAX(CASE WHEN status IN ('confirmed','approved') THEN payment_date END),
      (ARRAY_AGG(id ORDER BY created_at DESC) FILTER (WHERE status IN ('confirmed','approved')))[1],
      COUNT(*) FILTER (WHERE status IN ('confirmed','approved'))
    INTO v_mp_pending, v_mp_total, v_mp_last, v_mp_id, v_mp_count
    FROM public.manual_payments
    WHERE agreement_id = p_agreement_id
      AND (
        (installment_key IS NOT NULL AND installment_key = v_inst_key)
        OR (installment_key IS NULL AND installment_number = v_canon_inst_num)
        OR (installment_key IS NULL AND installment_number = v_display_num AND v_display_num <> v_canon_inst_num)
      );

    IF COALESCE(v_mp_pending, false) THEN v_pending := true; END IF;

    IF COALESCE(v_mp_count, 0) > 0 AND COALESCE(v_mp_total, 0) > 0 THEN
      v_paid := true;
      v_paid_at := COALESCE(v_mp_last::timestamptz, now());
      v_paid_amount := v_mp_total;
      v_paid_source := 'manual_payment';
      v_paid_source_id := v_mp_id;
    END IF;

    IF NOT v_paid THEN
      v_canon_key  := p_agreement_id::text || ':' || v_inst_key;
      v_legacy_key := CASE
        WHEN v_inst_is_entrada THEN NULL
        WHEN v_display_num <> v_canon_inst_num THEN p_agreement_id::text || ':' || v_display_num::text
        ELSE NULL
      END;
      v_cob_id := NULL;

      SELECT c.id, c.data_pagamento, c.valor_pago
      INTO v_cob_id, v_cob_pay_date, v_cob_amount
      FROM public.negociarie_cobrancas c
      WHERE c.agreement_id = p_agreement_id
        AND c.installment_key = v_canon_key
        AND c.data_vencimento = v_inst_due
        AND NOT (c.id = ANY(v_used))
        AND c.status IN ('pago','RECEIVED','CONFIRMED')
        AND COALESCE(c.superseded, false) = false
      ORDER BY c.created_at LIMIT 1;

      IF v_cob_id IS NULL AND v_legacy_key IS NOT NULL THEN
        SELECT c.id, c.data_pagamento, c.valor_pago
        INTO v_cob_id, v_cob_pay_date, v_cob_amount
        FROM public.negociarie_cobrancas c
        WHERE c.agreement_id = p_agreement_id
          AND c.installment_key = v_legacy_key
          AND c.data_vencimento = v_inst_due
          AND NOT (c.id = ANY(v_used))
          AND c.status IN ('pago','RECEIVED','CONFIRMED')
          AND COALESCE(c.superseded, false) = false
        ORDER BY c.created_at LIMIT 1;
      END IF;

      IF v_cob_id IS NULL THEN
        SELECT c.id, c.data_pagamento, c.valor_pago
        INTO v_cob_id, v_cob_pay_date, v_cob_amount
        FROM public.negociarie_cobrancas c
        WHERE c.agreement_id = p_agreement_id
          AND c.installment_key = v_canon_key
          AND NOT (c.id = ANY(v_used))
          AND c.status IN ('pago','RECEIVED','CONFIRMED')
          AND COALESCE(c.superseded, false) = false
        ORDER BY c.created_at LIMIT 1;
      END IF;

      IF v_cob_id IS NULL AND v_legacy_key IS NOT NULL THEN
        SELECT c.id, c.data_pagamento, c.valor_pago
        INTO v_cob_id, v_cob_pay_date, v_cob_amount
        FROM public.negociarie_cobrancas c
        WHERE c.agreement_id = p_agreement_id
          AND c.installment_key = v_legacy_key
          AND NOT (c.id = ANY(v_used))
          AND c.status IN ('pago','RECEIVED','CONFIRMED')
          AND COALESCE(c.superseded, false) = false
        ORDER BY c.created_at LIMIT 1;
      END IF;

      -- Fallback: data + valor (±5%) sem chave
      IF v_cob_id IS NULL THEN
        SELECT c.id, c.data_pagamento, c.valor_pago
        INTO v_cob_id, v_cob_pay_date, v_cob_amount
        FROM public.negociarie_cobrancas c
        WHERE c.agreement_id = p_agreement_id
          AND (c.installment_key IS NULL OR c.installment_key = '')
          AND c.data_vencimento = v_inst_due
          AND ABS(COALESCE(c.valor_pago, 0) - v_inst_amount) <= GREATEST(v_inst_amount * 0.05, 0.10)
          AND NOT (c.id = ANY(v_used))
          AND c.status IN ('pago','RECEIVED','CONFIRMED')
          AND COALESCE(c.superseded, false) = false
        ORDER BY c.created_at LIMIT 1;
      END IF;

      IF v_cob_id IS NOT NULL THEN
        v_paid := true;
        v_paid_at := COALESCE(v_cob_pay_date::timestamptz, now());
        v_paid_amount := v_cob_amount;
        v_paid_source := 'negociarie';
        v_paid_source_id := v_cob_id;
        v_used := array_append(v_used, v_cob_id);
      END IF;
    END IF;

    IF v_paid AND v_ag_broken THEN
      v_paid_after_break := true;
    END IF;

    UPDATE public.agreement_installments SET
      paid = v_paid,
      paid_at = CASE WHEN v_paid THEN COALESCE(v_paid_at, now()) ELSE NULL END,
      paid_amount = v_paid_amount,
      paid_source = v_paid_source,
      paid_source_id = v_paid_source_id,
      pending_confirmation = v_pending,
      paid_after_break = v_paid_after_break,
      updated_at = now()
    WHERE id = v_inst_id;
  END LOOP;
END;
$function$;

-- =========================================================================
-- 3. NOTIFICATION TRIGGER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_payment_after_break()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_ag      public.agreements%ROWTYPE;
  v_admin   RECORD;
  v_msg     text;
  v_already boolean;
BEGIN
  IF NEW.paid_after_break IS DISTINCT FROM true THEN RETURN NEW; END IF;
  IF OLD.paid_after_break IS NOT DISTINCT FROM NEW.paid_after_break THEN RETURN NEW; END IF;

  SELECT * INTO v_ag FROM public.agreements WHERE id = NEW.agreement_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.notifications
    WHERE tenant_id = NEW.tenant_id AND type = 'payment_after_break' AND reference_id = NEW.id
  ) INTO v_already;
  IF v_already THEN RETURN NEW; END IF;

  v_msg := format(
    'Cliente %s pagou %s de R$ %s mesmo com acordo quebrado.',
    v_ag.client_name,
    CASE WHEN NEW.is_entrada THEN 'entrada' ELSE 'parcela ' || NEW.installment_key END,
    to_char(COALESCE(NEW.paid_amount, NEW.amount), 'FM999G990D00')
  );

  FOR v_admin IN
    SELECT DISTINCT user_id FROM (
      SELECT v_ag.created_by AS user_id WHERE v_ag.created_by IS NOT NULL
      UNION
      SELECT p.id AS user_id FROM public.profiles p
      WHERE p.tenant_id = NEW.tenant_id AND p.role = 'admin'
    ) s WHERE user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications
      (tenant_id, user_id, title, message, type, reference_type, reference_id)
    VALUES
      (NEW.tenant_id, v_admin.user_id,
       'Pagamento recebido em acordo quebrado',
       v_msg, 'payment_after_break', 'agreement_installment', NEW.id);
  END LOOP;

  INSERT INTO public.audit_logs (tenant_id, user_id, user_name, action, entity_type, entity_id, details)
  VALUES (NEW.tenant_id, COALESCE(v_ag.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
          'system', 'payment_after_break', 'agreement_installment', NEW.id::text,
          jsonb_build_object('agreement_id', NEW.agreement_id, 'amount', NEW.paid_amount, 'paid_source', NEW.paid_source));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_payment_after_break ON public.agreement_installments;
CREATE TRIGGER trg_notify_payment_after_break
  AFTER UPDATE OF paid_after_break ON public.agreement_installments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_after_break();

-- =========================================================================
-- 4. RECONCILIAÇÃO Y.BRASIL
-- =========================================================================

-- 4a. Samantha
UPDATE public.manual_payments
SET installment_key = '1', installment_number = 1,
    notes = COALESCE(notes || E'\n', '') || '[Reconciliação 2026-05-14: chave 2 -> 1]'
WHERE id = 'e1f08488-5bc5-478d-872f-ef57599a3c62';

-- 4b. Fernanda :0 -> :entrada (não há ativo em :entrada)
UPDATE public.negociarie_cobrancas
SET installment_key = '4dbc5854-75bd-4b8b-9eb1-f030a831853b:entrada'
WHERE id = 'eedcba07-c7d6-4e76-89af-3a229d0ad922';

-- 4c. Ivanessa: já existe :entrada ativa (a77456ee). NULL-key é duplicata. Marca substituida.
UPDATE public.negociarie_cobrancas
SET status = 'substituido', superseded = true,
    callback_data = COALESCE(callback_data, '{}'::jsonb) ||
      jsonb_build_object('superseded_reason', 'duplicate_null_key', 'superseded_at', now())
WHERE id = '82b3d6e5-5f5f-4c42-a3b4-7a40a85873b3';

-- 4d. Valdenice :1 -> :entrada
UPDATE public.negociarie_cobrancas
SET installment_key = '684e056a-cb60-4eac-989d-e8a0d5b4f9c3:entrada'
WHERE id = 'cb8e1aa9-d92d-4bd1-b0d4-161eae3fbbc9';

-- 4e. Gabriella: cobrança duplicada (parcela já paga via manual)
UPDATE public.negociarie_cobrancas
SET status = 'substituido', superseded = true,
    callback_data = COALESCE(callback_data, '{}'::jsonb) ||
      jsonb_build_object('superseded_reason', 'duplicate_with_manual_payment', 'superseded_at', now())
WHERE id = 'fee5b723-5ffb-4c37-bd36-89d396bb9ecd';

-- 4f. Sem nome (sem agreement_id)
INSERT INTO public.payment_orphans (tenant_id, source, source_ref_id, amount, paid_at, reason, details)
VALUES (
  '39a450f8-7a40-46e5-8bc7-708da5043ec7', 'negociarie',
  '27a2fc82-e2bf-49f0-9256-3d1c7a628efa', 11, '2026-03-27'::timestamptz,
  'missing_agreement_id',
  jsonb_build_object('installment_key', '535df9af-1ff2-4df4-a7c5-6fa4b4170471:0', 'data_vencimento', '2026-03-31')
) ON CONFLICT DO NOTHING;

-- 4g. Re-roda rebuild (override de status)
DO $$
DECLARE v_ag uuid;
BEGIN
  PERFORM set_config('app.force_status_override', 'true', true);
  FOR v_ag IN
    SELECT DISTINCT a.id FROM public.agreements a
    WHERE a.tenant_id = '39a450f8-7a40-46e5-8bc7-708da5043ec7'
      AND (
        a.id IN (SELECT agreement_id FROM public.manual_payments WHERE tenant_id='39a450f8-7a40-46e5-8bc7-708da5043ec7' AND status IN ('confirmed','approved'))
        OR a.id IN (SELECT agreement_id FROM public.negociarie_cobrancas WHERE tenant_id='39a450f8-7a40-46e5-8bc7-708da5043ec7' AND status='pago' AND agreement_id IS NOT NULL)
      )
  LOOP
    PERFORM public.rebuild_agreement_installments(v_ag);
  END LOOP;
END $$;

INSERT INTO public.audit_logs (tenant_id, user_id, user_name, action, entity_type, entity_id, details)
VALUES (
  '39a450f8-7a40-46e5-8bc7-708da5043ec7',
  '00000000-0000-0000-0000-000000000000'::uuid, 'system',
  'orphan_reconciliation_batch', 'tenant',
  '39a450f8-7a40-46e5-8bc7-708da5043ec7',
  jsonb_build_object('migration', '20260514_reconcile_and_harden', 'reconciled', 8, 'moved_to_orphans', 1)
);
