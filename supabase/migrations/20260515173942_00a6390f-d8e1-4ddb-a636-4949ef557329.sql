CREATE OR REPLACE FUNCTION public.create_reconciliation_alerts_from_maxlist(
  _tenant_id UUID,
  _payments JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment JSONB;
  _agreement_id UUID;
  _installment RECORD;
  _inserted INTEGER := 0;
  _cpf_norm TEXT;
  _credor_norm TEXT;
BEGIN
  FOR _payment IN SELECT * FROM jsonb_array_elements(_payments)
  LOOP
    _cpf_norm := regexp_replace(COALESCE(_payment->>'cpf',''), '\D', '', 'g');
    _credor_norm := UPPER(BTRIM(COALESCE(_payment->>'credor','')));
    IF _cpf_norm = '' OR _credor_norm = '' THEN
      CONTINUE;
    END IF;

    SELECT id INTO _agreement_id
    FROM public.agreements
    WHERE tenant_id = _tenant_id
      AND regexp_replace(client_cpf, '\D', '', 'g') = _cpf_norm
      AND UPPER(BTRIM(credor)) = _credor_norm
      AND status IN ('approved','overdue')
    ORDER BY created_at DESC
    LIMIT 1;

    IF _agreement_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id, installment_key INTO _installment
    FROM public.agreement_installments
    WHERE agreement_id = _agreement_id
      AND paid = false
      AND cancelled = false
      AND pending_confirmation = false
    ORDER BY seq ASC
    LIMIT 1;

    IF _installment.id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.agreement_reconciliation_alerts (
      tenant_id, agreement_id, installment_id, installment_key,
      client_cpf, credor, maxlist_payment_value, maxlist_payment_date,
      maxlist_source_ref, maxlist_source_meta
    ) VALUES (
      _tenant_id, _agreement_id, _installment.id, _installment.installment_key,
      _cpf_norm, _payment->>'credor',
      COALESCE((_payment->>'valor_pago')::numeric, 0),
      NULLIF(_payment->>'data_pagamento','')::date,
      _payment->>'source_ref',
      COALESCE(_payment->'meta', '{}'::jsonb)
    )
    ON CONFLICT (agreement_id, maxlist_source_ref) DO NOTHING;

    IF FOUND THEN
      _inserted := _inserted + 1;
    END IF;
  END LOOP;

  RETURN _inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reconciliation_alerts_from_maxlist(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reconciliation_alerts_from_maxlist(UUID, JSONB) TO service_role;