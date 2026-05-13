-- Fase 5.1: RPC SSOT para totais financeiros por dia (lê agreement_installments)
CREATE OR REPLACE FUNCTION public.get_financial_received_by_day(
  _tenant_id uuid,
  _date_from date,
  _date_to date,
  _operator_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(payment_date date, total_recebido numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (ai.paid_at AT TIME ZONE 'America/Sao_Paulo')::date AS payment_date,
    SUM(COALESCE(ai.paid_amount, ai.amount, 0))::numeric AS total_recebido
  FROM public.agreement_installments ai
  WHERE ai.tenant_id = _tenant_id
    AND ai.paid = true
    AND ai.cancelled = false
    AND ai.paid_at IS NOT NULL
    AND (ai.paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _date_from AND _date_to
    AND public.can_access_tenant(_tenant_id)
    AND (
      _operator_ids IS NULL
      OR EXISTS (
        SELECT 1 FROM public.agreements a
        WHERE a.id = ai.agreement_id
          AND a.tenant_id = _tenant_id
          AND a.created_by = ANY(_operator_ids)
      )
    )
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_received_by_day(uuid, date, date, uuid[]) TO authenticated;