CREATE OR REPLACE FUNCTION public.get_carteira_overview(
  _tenant_id uuid,
  _credor text DEFAULT NULL
)
RETURNS TABLE (
  total_cpfs_base bigint,
  cpfs_inadimplentes bigint,
  parcelas_inadimplentes bigint,
  saldo_inadimplente_clients numeric,
  saldo_quebra_acordos numeric,
  saldo_total numeric,
  ticket_medio numeric,
  aging_0_30_qtd bigint,    aging_0_30_valor numeric,
  aging_31_90_qtd bigint,   aging_31_90_valor numeric,
  aging_91_180_qtd bigint,  aging_91_180_valor numeric,
  aging_181_365_qtd bigint, aging_181_365_valor numeric,
  aging_366_qtd bigint,     aging_366_valor numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH inad_clients AS (
    SELECT
      c.cpf,
      c.id,
      c.data_vencimento,
      COALESCE(c.valor_saldo, GREATEST(COALESCE(c.valor_parcela,0) - COALESCE(c.valor_pago,0), 0)) AS saldo,
      GREATEST((CURRENT_DATE - c.data_vencimento)::int, 0) AS dias_atraso
    FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_credor IS NULL OR c.credor = _credor)
      AND c.status = 'pendente'
      AND c.data_vencimento < CURRENT_DATE
  ),
  inad_installments AS (
    SELECT
      a.client_cpf AS cpf,
      ai.id,
      ai.due_date AS data_vencimento,
      GREATEST(COALESCE(ai.amount,0) - COALESCE(ai.paid_amount,0), 0) AS saldo,
      GREATEST((CURRENT_DATE - ai.due_date)::int, 0) AS dias_atraso
    FROM agreement_installments ai
    JOIN agreements a ON a.id = ai.agreement_id AND a.tenant_id = _tenant_id
    WHERE ai.tenant_id = _tenant_id
      AND COALESCE(ai.cancelled, false) = false
      AND COALESCE(ai.paid, false) = false
      AND ai.due_date < CURRENT_DATE
      AND COALESCE(ai.paid_amount,0) < COALESCE(ai.amount,0)
      AND (_credor IS NULL OR a.credor = _credor)
      AND COALESCE(a.status,'') NOT IN ('paid','completed','cancelled')
  ),
  unioned AS (
    SELECT cpf, id::text, data_vencimento, saldo, dias_atraso FROM inad_clients
    UNION ALL
    SELECT cpf, id::text, data_vencimento, saldo, dias_atraso FROM inad_installments
  ),
  base AS (
    SELECT COUNT(DISTINCT c.cpf) AS total_cpfs
    FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_credor IS NULL OR c.credor = _credor)
  ),
  quebra AS (
    SELECT COALESCE(SUM(GREATEST(COALESCE(ai.amount,0) - COALESCE(ai.paid_amount,0), 0)),0) AS valor_quebra
    FROM agreement_installments ai
    JOIN agreements a ON a.id = ai.agreement_id AND a.tenant_id = _tenant_id
    WHERE ai.tenant_id = _tenant_id
      AND COALESCE(a.status,'') IN ('broken','cancelled')
      AND COALESCE(ai.paid, false) = false
      AND COALESCE(ai.cancelled, false) = false
      AND (_credor IS NULL OR a.credor = _credor)
  )
  SELECT
    (SELECT total_cpfs FROM base),
    (SELECT COUNT(DISTINCT cpf) FROM unioned),
    (SELECT COUNT(*) FROM unioned),
    (SELECT COALESCE(SUM(saldo),0) FROM unioned),
    (SELECT valor_quebra FROM quebra),
    (SELECT COALESCE(SUM(saldo),0) FROM unioned) + (SELECT valor_quebra FROM quebra),
    CASE WHEN (SELECT COUNT(DISTINCT cpf) FROM unioned) > 0
      THEN ((SELECT COALESCE(SUM(saldo),0) FROM unioned) + (SELECT valor_quebra FROM quebra)) / (SELECT COUNT(DISTINCT cpf) FROM unioned)
      ELSE 0 END,
    (SELECT COUNT(*) FROM unioned WHERE dias_atraso BETWEEN 0 AND 30),
    (SELECT COALESCE(SUM(saldo),0) FROM unioned WHERE dias_atraso BETWEEN 0 AND 30),
    (SELECT COUNT(*) FROM unioned WHERE dias_atraso BETWEEN 31 AND 90),
    (SELECT COALESCE(SUM(saldo),0) FROM unioned WHERE dias_atraso BETWEEN 31 AND 90),
    (SELECT COUNT(*) FROM unioned WHERE dias_atraso BETWEEN 91 AND 180),
    (SELECT COALESCE(SUM(saldo),0) FROM unioned WHERE dias_atraso BETWEEN 91 AND 180),
    (SELECT COUNT(*) FROM unioned WHERE dias_atraso BETWEEN 181 AND 365),
    (SELECT COALESCE(SUM(saldo),0) FROM unioned WHERE dias_atraso BETWEEN 181 AND 365),
    (SELECT COUNT(*) FROM unioned WHERE dias_atraso >= 366),
    (SELECT COALESCE(SUM(saldo),0) FROM unioned WHERE dias_atraso >= 366)
$$;

GRANT EXECUTE ON FUNCTION public.get_carteira_overview(uuid, text) TO authenticated;