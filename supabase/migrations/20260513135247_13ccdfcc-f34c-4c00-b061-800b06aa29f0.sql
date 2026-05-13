
ALTER TABLE public.agreements
  ADD COLUMN IF NOT EXISTS paid_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overdue_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_due_date DATE,
  ADD COLUMN IF NOT EXISTS aggregates_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agreements_tenant_paid_count
  ON public.agreements (tenant_id, paid_count);
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_next_due
  ON public.agreements (tenant_id, next_due_date);

CREATE OR REPLACE FUNCTION public.recompute_agreement_aggregates(p_agreement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_paid INT := 0;
  v_total INT := 0;
  v_pending INT := 0;
  v_overdue INT := 0;
  v_last_paid TIMESTAMPTZ;
  v_next_due DATE;
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE paid AND NOT cancelled),
    COUNT(*) FILTER (WHERE NOT cancelled),
    COUNT(*) FILTER (WHERE NOT paid AND NOT cancelled AND due_date >= v_today),
    COUNT(*) FILTER (WHERE NOT paid AND NOT cancelled AND due_date < v_today),
    MAX(paid_at) FILTER (WHERE paid),
    MIN(due_date) FILTER (WHERE NOT paid AND NOT cancelled)
  INTO v_paid, v_total, v_pending, v_overdue, v_last_paid, v_next_due
  FROM public.agreement_installments
  WHERE agreement_id = p_agreement_id;

  UPDATE public.agreements
  SET paid_count = COALESCE(v_paid, 0),
      total_count = COALESCE(v_total, 0),
      pending_count = COALESCE(v_pending, 0),
      overdue_count = COALESCE(v_overdue, 0),
      last_paid_at = v_last_paid,
      next_due_date = v_next_due,
      aggregates_updated_at = now()
  WHERE id = p_agreement_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.trg_agreement_installments_recompute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recompute_agreement_aggregates(OLD.agreement_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_agreement_aggregates(NEW.agreement_id);
    IF (TG_OP = 'UPDATE' AND NEW.agreement_id IS DISTINCT FROM OLD.agreement_id) THEN
      PERFORM public.recompute_agreement_aggregates(OLD.agreement_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$func$;

DROP TRIGGER IF EXISTS trg_agreement_installments_aggregate ON public.agreement_installments;
CREATE TRIGGER trg_agreement_installments_aggregate
AFTER INSERT OR UPDATE OR DELETE ON public.agreement_installments
FOR EACH ROW
EXECUTE FUNCTION public.trg_agreement_installments_recompute();
