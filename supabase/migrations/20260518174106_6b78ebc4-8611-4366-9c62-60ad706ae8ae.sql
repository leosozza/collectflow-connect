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
  WITH inad AS (
    SELECT
      c.cpf,
      c.id,
      c.data_vencimento,
      COALESCE(c.valor_saldo, GREATEST(COALESCE(c.valor_parcela,0) - COALESCE(c.valor_pago,0), 0)) AS saldo,
      GREATEST((CURRENT_DATE - c.data_vencimento)::int, 0) AS dias_atraso
    FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_credor IS NULL OR c.credor = _credor)
      AND c.data_vencimento < CURRENT_DATE
      AND c.status::text NOT IN ('pago','quitado')
      AND COALESCE(c.valor_saldo, GREATEST(COALESCE(c.valor_parcela,0) - COALESCE(c.valor_pago,0), 0)) > 0
  ),
  base AS (
    SELECT COUNT(DISTINCT c.cpf) AS total_cpfs
    FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_credor IS NULL OR c.credor = _credor)
  )
  SELECT
    (SELECT total_cpfs FROM base),
    (SELECT COUNT(DISTINCT cpf) FROM inad),
    (SELECT COUNT(*) FROM inad),
    (SELECT COALESCE(SUM(saldo),0) FROM inad),
    0::numeric,
    (SELECT COALESCE(SUM(saldo),0) FROM inad),
    CASE WHEN (SELECT COUNT(DISTINCT cpf) FROM inad) > 0
      THEN (SELECT COALESCE(SUM(saldo),0) FROM inad) / (SELECT COUNT(DISTINCT cpf) FROM inad)
      ELSE 0 END,
    (SELECT COUNT(*) FROM inad WHERE dias_atraso BETWEEN 0 AND 30),
    (SELECT COALESCE(SUM(saldo),0) FROM inad WHERE dias_atraso BETWEEN 0 AND 30),
    (SELECT COUNT(*) FROM inad WHERE dias_atraso BETWEEN 31 AND 90),
    (SELECT COALESCE(SUM(saldo),0) FROM inad WHERE dias_atraso BETWEEN 31 AND 90),
    (SELECT COUNT(*) FROM inad WHERE dias_atraso BETWEEN 91 AND 180),
    (SELECT COALESCE(SUM(saldo),0) FROM inad WHERE dias_atraso BETWEEN 91 AND 180),
    (SELECT COUNT(*) FROM inad WHERE dias_atraso BETWEEN 181 AND 365),
    (SELECT COALESCE(SUM(saldo),0) FROM inad WHERE dias_atraso BETWEEN 181 AND 365),
    (SELECT COUNT(*) FROM inad WHERE dias_atraso >= 366),
    (SELECT COALESCE(SUM(saldo),0) FROM inad WHERE dias_atraso >= 366)
$$;

GRANT EXECUTE ON FUNCTION public.get_carteira_overview(uuid, text) TO authenticated;