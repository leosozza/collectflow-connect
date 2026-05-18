CREATE OR REPLACE FUNCTION public.get_bi_projected_by_day(
  _tenant_id uuid,
  _date_from date,
  _date_to date,
  _credor text[] DEFAULT NULL,
  _operator_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(due_date date, total_projetado numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ai.due_date, SUM(ai.amount)::numeric AS total_projetado
  FROM public.agreement_installments ai
  JOIN public.agreements a ON a.id = ai.agreement_id
  WHERE ai.tenant_id = _tenant_id
    AND public.can_access_tenant(_tenant_id)
    AND ai.cancelled = false
    AND a.status <> 'cancelled'
    AND ai.due_date >= _date_from
    AND ai.due_date <= _date_to
    AND (_credor IS NULL OR a.credor = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  GROUP BY ai.due_date
  ORDER BY ai.due_date;
$$;