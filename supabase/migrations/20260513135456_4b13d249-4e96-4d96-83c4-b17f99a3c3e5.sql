
CREATE OR REPLACE FUNCTION public._oneshot_backfill_agreement_aggregates()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $oneshot$
DECLARE
  v_count INT;
BEGIN
  WITH agg AS (
    SELECT
      agreement_id,
      COUNT(*) FILTER (WHERE paid AND NOT cancelled)::int AS paid_count,
      COUNT(*) FILTER (WHERE NOT cancelled)::int AS total_count,
      COUNT(*) FILTER (WHERE NOT paid AND NOT cancelled AND due_date >= CURRENT_DATE)::int AS pending_count,
      COUNT(*) FILTER (WHERE NOT paid AND NOT cancelled AND due_date < CURRENT_DATE)::int AS overdue_count,
      MAX(paid_at) FILTER (WHERE paid) AS last_paid_at,
      MIN(due_date) FILTER (WHERE NOT paid AND NOT cancelled) AS next_due_date
    FROM public.agreement_installments
    GROUP BY agreement_id
  )
  UPDATE public.agreements a
  SET paid_count = COALESCE(agg.paid_count, 0),
      total_count = COALESCE(agg.total_count, 0),
      pending_count = COALESCE(agg.pending_count, 0),
      overdue_count = COALESCE(agg.overdue_count, 0),
      last_paid_at = agg.last_paid_at,
      next_due_date = agg.next_due_date,
      aggregates_updated_at = now()
  FROM agg
  WHERE a.id = agg.agreement_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$oneshot$;

COMMENT ON FUNCTION public._oneshot_backfill_agreement_aggregates() IS
  'Run via SELECT public._oneshot_backfill_agreement_aggregates(); after creation. Drop afterwards.';
