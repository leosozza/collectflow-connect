
-- Parte A: Adicionar valor ao enum client_status
ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'cancelado_maxlist';

-- Parte C: Trigger preventivo (criada antes do UPDATE da Parte B para validar a reversão)
CREATE OR REPLACE FUNCTION public.tg_block_premature_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _open_count int;
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status,'') <> 'completed' THEN
    SELECT COUNT(*) INTO _open_count
    FROM public.agreement_installments
    WHERE agreement_id = NEW.id
      AND NOT paid
      AND NOT cancelled;
    IF _open_count > 0 THEN
      RAISE EXCEPTION 'Cannot mark agreement % as completed: % installment(s) still open in SSOT', NEW.id, _open_count
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_premature_completion ON public.agreements;
CREATE TRIGGER trg_block_premature_completion
BEFORE UPDATE ON public.agreements
FOR EACH ROW EXECUTE FUNCTION public.tg_block_premature_completion();
