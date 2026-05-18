DROP FUNCTION IF EXISTS public.get_bi_projected_by_day(uuid, date, date, text[], uuid[]);

CREATE OR REPLACE FUNCTION public.get_bi_projected_by_day(
  _tenant_id uuid,
  _date_from date,
  _date_to date,
  _credor text[] DEFAULT NULL,
  _operator_ids uuid[] DEFAULT NULL
) RETURNS TABLE(ref_date date, total_projetado numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS ref_date,
    COALESCE(SUM(ai.amount), 0)::numeric AS total_projetado
  FROM public.agreements a
  JOIN public.agreement_installments ai
    ON ai.agreement_id = a.id
   AND ai.tenant_id = a.tenant_id
   AND ai.is_entrada = true
   AND ai.cancelled = false
  WHERE a.tenant_id = _tenant_id
    AND public.can_access_tenant(_tenant_id)
    AND COALESCE(a.status, '') <> 'cancelled'
    AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _date_from AND _date_to
    AND (_credor IS NULL OR a.credor = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  GROUP BY 1
  ORDER BY 1;
$$;