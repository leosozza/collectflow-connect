CREATE OR REPLACE FUNCTION public.run_ssot_shadow_check(_tenant_id uuid, _status_sample int DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _c_paid int := 0;
  _c_status int := 0;
  _c_orphan int := 0;
  _c_overdue int := 0;
  _status_scanned int := 0;
  r record;
BEGIN
  -- 1) paid_count_mismatch (full scan, fast: indexed by tenant)
  FOR r IN
    SELECT a.id, a.client_cpf, a.credor, a.paid_count AS expected_paid,
           COALESCE(s.paid_real, 0) AS actual_paid
    FROM agreements a
    LEFT JOIN (
      SELECT agreement_id, COUNT(*) FILTER (WHERE paid AND NOT cancelled) AS paid_real
      FROM agreement_installments
      WHERE tenant_id = _tenant_id
      GROUP BY agreement_id
    ) s ON s.agreement_id = a.id
    WHERE a.tenant_id = _tenant_id
      AND a.status IN ('pending','approved','completed')
      AND COALESCE(a.paid_count, 0) <> COALESCE(s.paid_real, 0)
  LOOP
    PERFORM upsert_ssot_shadow_check(_tenant_id, 'paid_count_mismatch', r.id,
      format('CPF %s | %s', r.client_cpf, r.credor),
      jsonb_build_object('paid_count_ssot', r.actual_paid),
      jsonb_build_object('paid_count_aggregated', r.expected_paid), 'error');
    _c_paid := _c_paid + 1;
  END LOOP;

  -- 2) carteira_status_mismatch — sampled to bound runtime
  FOR r IN
    WITH sampled AS (
      SELECT cpf, credor, status, id
      FROM clients
      WHERE tenant_id = _tenant_id
      ORDER BY random()
      LIMIT _status_sample
    ),
    pares AS (
      SELECT cpf, credor,
        CASE WHEN bool_or(status='vencido') THEN 'vencido'
             WHEN bool_or(status='em_acordo') THEN 'em_acordo'
             WHEN bool_or(status='pendente') THEN 'pendente'
             WHEN bool_or(status='quebrado') THEN 'quebrado'
             ELSE 'pago' END AS legacy_status,
        (array_agg(id))[1] AS rep_id
      FROM sampled GROUP BY cpf, credor
    )
    SELECT p.rep_id AS id, p.cpf, p.credor, p.legacy_status,
           map_canonical_to_legacy_status(get_client_consolidated_status(_tenant_id, p.cpf, p.credor)) AS ssot_status
    FROM pares p
    WHERE p.legacy_status <> map_canonical_to_legacy_status(get_client_consolidated_status(_tenant_id, p.cpf, p.credor))
  LOOP
    PERFORM upsert_ssot_shadow_check(_tenant_id, 'carteira_status_mismatch', r.id,
      format('CPF %s | %s', r.cpf, r.credor),
      jsonb_build_object('ssot_status', r.ssot_status),
      jsonb_build_object('legacy_status', r.legacy_status), 'warn');
    _c_status := _c_status + 1;
  END LOOP;

  -- 3) orphan_paid_source
  FOR r IN
    SELECT mp.id, mp.agreement_id, COALESCE(mp.installment_key, mp.installment_number::text) AS ikey,
           a.client_cpf, a.credor
    FROM manual_payments mp
    JOIN agreements a ON a.id = mp.agreement_id
    LEFT JOIN agreement_installments ai
      ON ai.agreement_id = mp.agreement_id
     AND ai.installment_key = COALESCE(mp.installment_key, mp.installment_number::text)
    WHERE mp.tenant_id = _tenant_id
      AND mp.status = 'confirmed'
      AND (ai.id IS NULL OR ai.paid = false OR ai.cancelled = true)
    LIMIT 500
  LOOP
    PERFORM upsert_ssot_shadow_check(_tenant_id, 'orphan_paid_source', r.id,
      format('Manual payment %s | CPF %s | %s', r.ikey, r.client_cpf, r.credor),
      jsonb_build_object('manual_payment_confirmed', true, 'agreement_id', r.agreement_id, 'installment_key', r.ikey),
      jsonb_build_object('ssot_paid', false), 'error');
    _c_orphan := _c_orphan + 1;
  END LOOP;

  -- 4) overdue_agreement_not_broken
  FOR r IN
    SELECT a.id, a.client_cpf, a.credor, MAX(_today - ai.due_date) AS max_dias
    FROM agreements a
    JOIN agreement_installments ai ON ai.agreement_id = a.id
    WHERE a.tenant_id = _tenant_id
      AND a.status = 'approved'
      AND NOT ai.cancelled AND NOT ai.paid
      AND ai.due_date < _today - 30
    GROUP BY a.id, a.client_cpf, a.credor
  LOOP
    PERFORM upsert_ssot_shadow_check(_tenant_id, 'overdue_agreement_not_broken', r.id,
      format('CPF %s | %s', r.client_cpf, r.credor),
      jsonb_build_object('expected_status', 'cancelled', 'max_overdue_days', r.max_dias),
      jsonb_build_object('actual_status', 'approved'), 'warn');
    _c_overdue := _c_overdue + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_id', _tenant_id, 'run_at', now(),
    'mismatches_found', _c_paid + _c_status + _c_orphan + _c_overdue,
    'status_sample_size', _status_sample,
    'by_type', jsonb_build_object(
      'paid_count_mismatch', _c_paid,
      'carteira_status_mismatch', _c_status,
      'orphan_paid_source', _c_orphan,
      'overdue_agreement_not_broken', _c_overdue
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_ssot_shadow_check(uuid, int) TO service_role;