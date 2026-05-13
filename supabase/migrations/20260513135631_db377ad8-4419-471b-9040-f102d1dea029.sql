
CREATE OR REPLACE FUNCTION public.tg_rebuild_from_agreement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.agreement_installments WHERE agreement_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.rebuild_agreement_installments(NEW.id);
    RETURN NEW;
  END IF;

  -- UPDATE: só reconstroi se colunas que afetam o cronograma de fato mudaram.
  -- Atualizações de agregados (paid_count, last_paid_at, etc.) NÃO disparam rebuild.
  IF (
       NEW.new_installments IS DISTINCT FROM OLD.new_installments
    OR NEW.new_installment_value IS DISTINCT FROM OLD.new_installment_value
    OR NEW.first_due_date IS DISTINCT FROM OLD.first_due_date
    OR NEW.entrada_value IS DISTINCT FROM OLD.entrada_value
    OR NEW.entrada_date IS DISTINCT FROM OLD.entrada_date
    OR NEW.proposed_total IS DISTINCT FROM OLD.proposed_total
    OR NEW.custom_installment_dates IS DISTINCT FROM OLD.custom_installment_dates
    OR NEW.custom_installment_values IS DISTINCT FROM OLD.custom_installment_values
    OR NEW.installment_breakdown IS DISTINCT FROM OLD.installment_breakdown
    OR NEW.cancelled_installments IS DISTINCT FROM OLD.cancelled_installments
    OR NEW.status IS DISTINCT FROM OLD.status
  ) THEN
    PERFORM public.rebuild_agreement_installments(NEW.id);
  END IF;

  RETURN NEW;
END;
$func$;
