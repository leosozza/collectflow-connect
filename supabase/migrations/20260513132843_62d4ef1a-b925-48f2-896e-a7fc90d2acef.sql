CREATE OR REPLACE FUNCTION public.rebuild_agreement_installments(p_agreement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- por parcela
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
  v_canon_inst_num   int;  -- 0 = entrada, 1..N = parcelas mensais (canonical)
  v_display_num      int;  -- número exibido (com offset da entrada) — só para legacy lookup
  v_cob_id           uuid;
  v_cob_pay_date     date;
  v_cob_amount       numeric;
BEGIN
  SELECT * INTO v_ag FROM public.agreements WHERE id = p_agreement_id;
  IF NOT FOUND THEN
    DELETE FROM public.agreement_installments WHERE agreement_id = p_agreement_id;
    RETURN;
  END IF;

  v_custom_dates  := COALESCE(v_ag.custom_installment_dates, '{}'::jsonb);
  v_custom_values := COALESCE(v_ag.custom_installment_values, '{}'::jsonb);
  v_cancelled     := COALESCE(v_ag.cancelled_installments, '{}'::jsonb);

  DELETE FROM public.agreement_installments WHERE agreement_id = p_agreement_id;

  -- 1. Chaves de entrada
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

  -- 2. Insere entradas
  IF v_has_entrada THEN
    FOREACH v_key IN ARRAY v_entrada_keys LOOP
      v_due := COALESCE((v_custom_dates ->> v_key)::date, v_ag.entrada_date, v_ag.first_due_date);
      v_amount := COALESCE((v_custom_values ->> v_key)::numeric, v_ag.entrada_value, 0);
      v_is_cancelled := v_cancelled ? v_key;

      INSERT INTO public.agreement_installments
        (tenant_id, agreement_id, installment_key, seq, is_entrada, due_date, amount, cancelled)
      VALUES
        (v_ag.tenant_id, v_ag.id, v_key, v_seq, true, v_due, v_amount, v_is_cancelled);
      v_seq := v_seq + 1;
    END LOOP;
  END IF;

  -- 3. Insere parcelas mensais com chave CANÔNICA (1..N independente de entrada)
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
    VALUES
      (v_ag.tenant_id, v_ag.id, v_key, v_seq, false, v_due, v_amount, v_is_cancelled);
    v_seq := v_seq + 1;
  END LOOP;

  -- 4. Resolve pagamentos (anti-leak)
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

    -- canonical: 0 entrada, 1..N parcelas
    v_canon_inst_num := CASE
      WHEN v_inst_is_entrada THEN 0
      ELSE (v_inst_seq - v_entrada_count + 1)
    END;
    -- display: com offset da entrada (legado)
    v_display_num := CASE
      WHEN v_inst_is_entrada THEN 0
      ELSE (CASE WHEN v_has_entrada THEN 1 ELSE 0 END) + v_canon_inst_num
    END;

    -- 4a. Manual payment: chave canônica primeiro, número canônico, fallback display
    SELECT
      bool_or(status = 'pending_confirmation'),
      SUM(CASE WHEN status IN ('confirmed','approved') THEN COALESCE(amount_paid, 0) ELSE 0 END),
      MAX(CASE WHEN status IN ('confirmed','approved') THEN payment_date END),
      (ARRAY_AGG(id ORDER BY created_at DESC) FILTER (WHERE status IN ('confirmed','approved')))[1]
    INTO v_mp_pending, v_mp_total, v_mp_last, v_mp_id
    FROM public.manual_payments
    WHERE agreement_id = p_agreement_id
      AND (
        (installment_key IS NOT NULL AND installment_key = v_inst_key)
        OR (installment_key IS NULL AND installment_number = v_canon_inst_num)
        OR (installment_key IS NULL AND installment_number = v_display_num AND v_display_num <> v_canon_inst_num)
      );

    IF COALESCE(v_mp_pending, false) THEN v_pending := true; END IF;

    IF COALESCE(v_mp_total, 0) >= v_inst_amount - 0.01 AND v_inst_amount > 0 THEN
      v_paid := true;
      v_paid_at := COALESCE(v_mp_last::timestamptz, now());
      v_paid_amount := v_mp_total;
      v_paid_source := 'manual_payment';
      v_paid_source_id := v_mp_id;
    END IF;

    -- 4b. Negociarie cobrança
    IF NOT v_paid THEN
      v_canon_key  := p_agreement_id::text || ':' || v_inst_key;
      v_legacy_key := CASE
        WHEN v_inst_is_entrada THEN NULL
        WHEN v_display_num <> v_canon_inst_num THEN p_agreement_id::text || ':' || v_display_num::text
        ELSE NULL
      END;

      v_cob_id := NULL;

      -- P1: canônica + data igual
      SELECT c.id, c.data_pagamento, c.valor_pago
      INTO v_cob_id, v_cob_pay_date, v_cob_amount
      FROM public.negociarie_cobrancas c
      WHERE c.agreement_id = p_agreement_id
        AND c.installment_key = v_canon_key
        AND c.data_vencimento = v_inst_due
        AND NOT (c.id = ANY(v_used))
        AND c.status IN ('pago','RECEIVED','CONFIRMED')
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

    UPDATE public.agreement_installments SET
      paid = v_paid,
      paid_at = CASE WHEN v_paid THEN COALESCE(v_paid_at, now()) ELSE NULL END,
      paid_amount = v_paid_amount,
      paid_source = v_paid_source,
      paid_source_id = v_paid_source_id,
      pending_confirmation = v_pending,
      updated_at = now()
    WHERE id = v_inst_id;
  END LOOP;
END;
$$;

-- Reroda backfill com convenção corrigida
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.agreements LOOP
    PERFORM public.rebuild_agreement_installments(r.id);
  END LOOP;
END $$;