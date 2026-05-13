
-- Segunda e terceira passadas para resolver cadeias longas (parcela 4 → 3 só pode mover
-- depois que parcela 3 → 2 saiu da chave alvo).
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..5 LOOP
    WITH agreements_w_entrada AS (
      SELECT id, entrada_value, entrada_date, first_due_date, new_installments, custom_installment_dates
      FROM public.agreements
      WHERE COALESCE(entrada_value, 0) > 0
    ),
    expected AS (
      SELECT a.id AS agreement_id,
             'entrada'::text AS canonical_key,
             COALESCE(
               NULLIF(a.custom_installment_dates->>'entrada','')::date,
               a.entrada_date::date,
               a.first_due_date::date
             ) AS expected_due
      FROM agreements_w_entrada a
      UNION ALL
      SELECT a.id,
             gs::text,
             COALESCE(
               NULLIF(a.custom_installment_dates->>gs::text,'')::date,
               (a.first_due_date + ((gs - 1) || ' months')::interval)::date
             )
      FROM agreements_w_entrada a,
           generate_series(1, GREATEST(a.new_installments, 1)) gs
    ),
    candidates AS (
      SELECT nc.id,
             nc.agreement_id,
             nc.installment_key AS current_key,
             (nc.agreement_id::text || ':' || e.canonical_key) AS desired_key
      FROM public.negociarie_cobrancas nc
      JOIN expected e
        ON e.agreement_id = nc.agreement_id
       AND e.expected_due = nc.data_vencimento::date
      WHERE nc.status <> 'substituido'
    ),
    to_update AS (
      SELECT c.id, c.desired_key
      FROM candidates c
      WHERE c.current_key IS DISTINCT FROM c.desired_key
        AND NOT EXISTS (
          SELECT 1 FROM public.negociarie_cobrancas nc2
          WHERE nc2.agreement_id = c.agreement_id
            AND nc2.installment_key = c.desired_key
            AND nc2.status <> 'substituido'
            AND nc2.id <> c.id
        )
    )
    UPDATE public.negociarie_cobrancas nc
    SET installment_key = u.desired_key,
        updated_at = now()
    FROM to_update u
    WHERE nc.id = u.id;
  END LOOP;
END $$;
