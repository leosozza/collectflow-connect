CREATE OR REPLACE FUNCTION public.create_reconciliation_alerts_from_maxlist(
  _tenant_id uuid,
  _payments jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p jsonb;
  v_cpf text;
  v_credor text;
  v_value numeric;
  v_date date;
  v_source_ref text;
  v_meta jsonb;
  v_agreement_id uuid;
  v_created int := 0;
  v_has_recent_match boolean;
BEGIN
  IF _payments IS NULL OR jsonb_array_length(_payments) = 0 THEN
    RETURN 0;
  END IF;

  FOR p IN SELECT * FROM jsonb_array_elements(_payments)
  LOOP
    v_cpf       := regexp_replace(COALESCE(p->>'cpf',''), '\D', '', 'g');
    v_credor    := COALESCE(p->>'credor','');
    v_value     := COALESCE((p->>'valor_pago')::numeric, 0);
    v_date      := NULLIF(p->>'data_pagamento','')::date;
    v_source_ref:= COALESCE(p->>'source_ref','');
    v_meta      := COALESCE(p->'meta','{}'::jsonb);

    IF v_cpf = '' OR v_credor = '' OR v_source_ref = '' THEN
      CONTINUE;
    END IF;

    SELECT a.id INTO v_agreement_id
    FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND regexp_replace(COALESCE(a.client_cpf,''),'\D','','g') = v_cpf
      AND a.status IN ('approved','overdue')
      AND (a.credor IS NULL OR lower(trim(a.credor)) = lower(trim(v_credor)))
    ORDER BY a.created_at DESC
    LIMIT 1;

    IF v_agreement_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM (
        SELECT mp.amount_paid AS val, mp.payment_date::date AS dt
          FROM manual_payments mp
         WHERE mp.tenant_id = _tenant_id
           AND mp.agreement_id = v_agreement_id
           AND mp.status IN ('pending_confirmation','confirmed')
        UNION ALL
        SELECT pp.amount, pp.created_at::date
          FROM portal_payments pp
         WHERE pp.tenant_id = _tenant_id
           AND pp.agreement_id = v_agreement_id
           AND pp.status IN ('approved','confirmed','paid')
        UNION ALL
        SELECT nc.valor_pago, nc.data_pagamento
          FROM negociarie_cobrancas nc
         WHERE nc.tenant_id = _tenant_id
           AND nc.agreement_id = v_agreement_id
           AND nc.valor_pago IS NOT NULL
      ) src
      WHERE abs(COALESCE(src.val,0) - v_value) <= 1.00
        AND (v_date IS NULL OR src.dt IS NULL OR abs(src.dt - v_date) <= 7)
    ) INTO v_has_recent_match;

    IF v_has_recent_match THEN
      CONTINUE;
    END IF;

    INSERT INTO agreement_reconciliation_alerts (
      tenant_id, agreement_id, installment_id, installment_key,
      client_cpf, credor,
      maxlist_payment_value, maxlist_payment_date,
      maxlist_source_ref, maxlist_source_meta, status
    ) VALUES (
      _tenant_id, v_agreement_id, NULL, NULL,
      v_cpf, v_credor,
      v_value, v_date,
      v_source_ref, v_meta, 'pending'
    )
    ON CONFLICT (agreement_id, maxlist_source_ref) DO NOTHING;

    IF FOUND THEN
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN v_created;
END;
$$;

WITH compatibles AS (
  SELECT a.id AS alert_id
  FROM agreement_reconciliation_alerts a
  WHERE a.status IN ('pending','pending_admin_approval')
    AND EXISTS (
      SELECT 1 FROM (
        SELECT mp.amount_paid AS val, mp.payment_date::date AS dt
          FROM manual_payments mp
         WHERE mp.agreement_id = a.agreement_id
           AND mp.tenant_id = a.tenant_id
           AND mp.status IN ('pending_confirmation','confirmed')
        UNION ALL
        SELECT pp.amount, pp.created_at::date
          FROM portal_payments pp
         WHERE pp.agreement_id = a.agreement_id
           AND pp.tenant_id = a.tenant_id
           AND pp.status IN ('approved','confirmed','paid')
        UNION ALL
        SELECT nc.valor_pago, nc.data_pagamento
          FROM negociarie_cobrancas nc
         WHERE nc.agreement_id = a.agreement_id
           AND nc.tenant_id = a.tenant_id
           AND nc.valor_pago IS NOT NULL
      ) src
      WHERE abs(COALESCE(src.val,0) - a.maxlist_payment_value) <= 1.00
        AND (a.maxlist_payment_date IS NULL OR src.dt IS NULL
             OR abs(src.dt - a.maxlist_payment_date) <= 7)
    )
)
UPDATE agreement_reconciliation_alerts a
   SET status = 'resolved_ignored',
       resolved_at = now(),
       resolution_notes = COALESCE(NULLIF(a.resolution_notes,''),'') ||
         CASE WHEN COALESCE(a.resolution_notes,'')='' THEN '' ELSE E'\n' END ||
         'auto: regra atualizada — baixa Rivo compatível já registrada (reflexo Maxsystem).'
  FROM compatibles c
 WHERE a.id = c.alert_id;