
-- Backfill canônico de installment_key em negociarie_cobrancas.
-- Acordos com entrada antigamente gravavam parcela 1 como ":2", parcela 2 como ":3"...
-- O gerador atual e a UI usam chave canônica (parcela 1 → ":1", entrada → ":entrada").
-- Aqui, para cada cobrança ativa, calculamos a chave canônica esperada via match
-- exato de data_vencimento contra a programação do acordo e atualizamos onde diferir.
-- Idempotente: não regrava registros já canônicos e não cria colisão (verifica que
-- nenhuma outra cobrança ativa do mesmo acordo já ocupa a chave alvo).
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
