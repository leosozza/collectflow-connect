CREATE OR REPLACE FUNCTION public.get_bi_projected_by_day(
  _tenant_id uuid,
  _date_from date,
  _date_to date,
  _credor text[] DEFAULT NULL,
  _operator_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(ref_date date, total_projetado numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_tenant(_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', _tenant_id;
  END IF;

  RETURN QUERY
  SELECT
    a.created_at::date AS ref_date,
    SUM(
      CASE WHEN a.entrada_value > 0
        THEN COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value)
        ELSE COALESCE((a.custom_installment_values->>'1')::numeric, a.new_installment_value)
      END
    )::numeric AS total_projetado
  FROM public.agreements a
  WHERE a.tenant_id = _tenant_id
    AND a.status <> 'cancelled'
    AND a.created_at::date BETWEEN _date_from AND _date_to
    AND (_credor IS NULL OR a.credor = ANY(_credor))
    AND (_operator_ids IS NULL OR a.created_by = ANY(_operator_ids))
  GROUP BY a.created_at::date;
END;
$$;