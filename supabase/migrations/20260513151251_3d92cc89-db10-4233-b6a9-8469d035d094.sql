
-- 1. Add notes & subtype columns
ALTER TABLE public.ssot_shadow_checks
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS subtype text;

-- 2. Recreate run_ssot_shadow_check with refined logic
CREATE OR REPLACE FUNCTION public.run_ssot_shadow_check(_tenant_id uuid, _status_sample integer DEFAULT 1000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _c_paid int := 0;
  _c_status int := 0;
  _c_orphan int := 0;
  _c_overdue int := 0;
  _status_scanned int := 0;
  _recent_sync boolean := false;
  r record;
BEGIN
  -- 1) paid_count_mismatch
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

  -- 2) carteira_status_mismatch — anti-race: skip if recent sync
  SELECT EXISTS (
    SELECT 1 FROM clients
    WHERE tenant_id = _tenant_id
      AND updated_at > now() - interval '5 minutes'
    LIMIT 1
  ) INTO _recent_sync;

  IF NOT _recent_sync THEN
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
  END IF;

  -- 3) orphan_paid_source — refined: only real divergences
  FOR r IN
    WITH agr AS (
      SELECT a.id, a.client_cpf, a.credor,
             COALESCE(a.entrada_value, 0) > 0 AS has_entrada,
             COALESCE(
               (SELECT count(*)::int FROM jsonb_object_keys(COALESCE(a.custom_installment_values,'{}'::jsonb)) k
                WHERE k = 'entrada' OR k ~ '^entrada_\d+$'),
               CASE WHEN COALESCE(a.entrada_value,0) > 0 THEN 1 ELSE 0 END
             ) AS entrada_count
      FROM agreements a WHERE a.tenant_id = _tenant_id
    ),
    mp_with_canon AS (
      SELECT mp.id, mp.agreement_id, mp.installment_key, mp.installment_number,
             mp.amount_paid, agr.client_cpf, agr.credor, agr.has_entrada, agr.entrada_count
      FROM manual_payments mp
      JOIN agr ON agr.id = mp.agreement_id
      WHERE mp.tenant_id = _tenant_id
        AND mp.status = 'confirmed'
    ),
    matched AS (
      SELECT m.id AS mp_id, m.agreement_id, m.amount_paid, m.client_cpf, m.credor,
             COALESCE(m.installment_key, m.installment_number::text) AS display_key,
             ai.id AS ai_id, ai.amount AS ai_amount, ai.paid AS ai_paid, ai.cancelled AS ai_cancelled
      FROM mp_with_canon m
      LEFT JOIN agreement_installments ai
        ON ai.agreement_id = m.agreement_id
       AND (
         (m.installment_key IS NOT NULL AND ai.installment_key = m.installment_key)
         OR (m.installment_key IS NULL AND m.installment_number = 0 AND ai.is_entrada = true AND ai.seq = 0)
         OR (m.installment_key IS NULL AND m.installment_number > 0 AND ai.installment_key = m.installment_number::text)
       )
    )
    SELECT mp_id AS id, agreement_id, display_key AS ikey, client_cpf, credor,
           ai_id, ai_amount, amount_paid,
           CASE
             WHEN ai_id IS NULL THEN 'manual_payment_uses_legacy_key'
             WHEN amount_paid < ai_amount - 0.01 THEN NULL
             WHEN ai_cancelled THEN 'paid_but_cancelled'
             WHEN NOT ai_paid THEN 'paid_but_ssot_open'
             ELSE NULL
           END AS subtype
    FROM matched
    WHERE
      (ai_id IS NULL)
      OR (amount_paid >= ai_amount - 0.01 AND (NOT ai_paid OR ai_cancelled))
    LIMIT 500
  LOOP
    IF r.subtype IS NULL THEN CONTINUE; END IF;
    PERFORM upsert_ssot_shadow_check(_tenant_id, 'orphan_paid_source', r.id,
      format('Manual payment %s | CPF %s | %s', r.ikey, r.client_cpf, r.credor),
      jsonb_build_object(
        'manual_payment_confirmed', true,
        'agreement_id', r.agreement_id,
        'installment_key', r.ikey,
        'amount_paid', r.amount_paid,
        'ai_amount', r.ai_amount,
        'subtype', r.subtype
      ),
      jsonb_build_object('ssot_paid', false),
      CASE WHEN r.subtype = 'manual_payment_uses_legacy_key' THEN 'warn' ELSE 'error' END);
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
    'status_check_skipped', _recent_sync,
    'by_type', jsonb_build_object(
      'paid_count_mismatch', _c_paid,
      'carteira_status_mismatch', _c_status,
      'orphan_paid_source', _c_orphan,
      'overdue_agreement_not_broken', _c_overdue
    )
  );
END;
$function$;
