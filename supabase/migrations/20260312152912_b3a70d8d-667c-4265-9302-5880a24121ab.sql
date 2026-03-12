
CREATE OR REPLACE FUNCTION public.get_analytics_payments(_tenant_id uuid)
RETURNS TABLE(
  agreement_id uuid,
  created_by uuid,
  credor text,
  created_at timestamptz,
  proposed_total numeric,
  original_total numeric,
  status text,
  total_pago numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS agreement_id,
    a.created_by::uuid,
    a.credor,
    a.created_at,
    a.proposed_total::numeric,
    a.original_total::numeric,
    a.status,
    COALESCE(SUM(c.valor_pago), 0)::numeric AS total_pago
  FROM agreements a
  LEFT JOIN clients c
    ON c.tenant_id = a.tenant_id
    AND REPLACE(REPLACE(c.cpf, '.', ''), '-', '') = REPLACE(REPLACE(a.client_cpf, '.', ''), '-', '')
    AND c.credor = a.credor
  WHERE a.tenant_id = _tenant_id
    AND a.status NOT IN ('rejected')
  GROUP BY a.id, a.created_by, a.credor, a.created_at, a.proposed_total, a.original_total, a.status;
END;
$$;
