-- 1) Trigger function: post to cancel-agreement-boletos edge function on broken/cancelled
CREATE OR REPLACE FUNCTION public.trg_cancel_boletos_on_agreement_break()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT := 'https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/cancel-agreement-boletos';
  v_secret TEXT := 'Rivo$2020';
BEGIN
  IF NEW.status IN ('broken', 'cancelled') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', v_secret
      ),
      body := jsonb_build_object(
        'agreement_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'trigger', 'status_change',
        'from_status', OLD.status,
        'to_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_boletos_on_break ON public.agreements;
CREATE TRIGGER trg_cancel_boletos_on_break
AFTER UPDATE OF status ON public.agreements
FOR EACH ROW
EXECUTE FUNCTION public.trg_cancel_boletos_on_agreement_break();

-- 2) RPC: real balance for a CPF+credor (subtracts payments from prior broken/cancelled agreements)
CREATE OR REPLACE FUNCTION public.get_client_real_balance(
  _tenant_id UUID,
  _client_cpf TEXT,
  _credor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original NUMERIC := 0;
  v_paid_history NUMERIC := 0;
  v_paid_installments INT := 0;
  v_active_agreements INT := 0;
BEGIN
  IF NOT public.can_access_tenant(_tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Original debt from clients (sum across rows for this CPF+credor — multiple contracts possible)
  SELECT COALESCE(SUM(COALESCE(valor_atualizado, valor_saldo, 0)), 0)
    INTO v_original
  FROM public.clients
  WHERE tenant_id = _tenant_id
    AND regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = regexp_replace(COALESCE(_client_cpf, ''), '\D', '', 'g')
    AND COALESCE(credor, '') = COALESCE(_credor, '');

  -- Payments tied to broken/cancelled agreements for same CPF+credor
  WITH prior_agreements AS (
    SELECT id FROM public.agreements
    WHERE tenant_id = _tenant_id
      AND regexp_replace(COALESCE(client_cpf, ''), '\D', '', 'g') = regexp_replace(COALESCE(_client_cpf, ''), '\D', '', 'g')
      AND COALESCE(credor, '') = COALESCE(_credor, '')
      AND status IN ('broken', 'cancelled')
  ),
  paid_manual AS (
    SELECT COALESCE(SUM(amount_paid), 0) AS total, COUNT(*) AS cnt
    FROM public.manual_payments
    WHERE tenant_id = _tenant_id
      AND status = 'approved'
      AND agreement_id IN (SELECT id FROM prior_agreements)
  ),
  paid_portal AS (
    SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
    FROM public.portal_payments
    WHERE tenant_id = _tenant_id
      AND status = 'paid'
      AND agreement_id IN (SELECT id FROM prior_agreements)
  ),
  paid_negociarie AS (
    SELECT COALESCE(SUM(COALESCE(valor_pago, valor)), 0) AS total, COUNT(*) AS cnt
    FROM public.negociarie_cobrancas
    WHERE tenant_id = _tenant_id
      AND id_status = 801
      AND agreement_id IN (SELECT id FROM prior_agreements)
  )
  SELECT (m.total + p.total + n.total), (m.cnt + p.cnt + n.cnt)
    INTO v_paid_history, v_paid_installments
  FROM paid_manual m, paid_portal p, paid_negociarie n;

  SELECT COUNT(*) INTO v_active_agreements
  FROM public.agreements
  WHERE tenant_id = _tenant_id
    AND regexp_replace(COALESCE(client_cpf, ''), '\D', '', 'g') = regexp_replace(COALESCE(_client_cpf, ''), '\D', '', 'g')
    AND COALESCE(credor, '') = COALESCE(_credor, '')
    AND status IN ('active', 'pending_approval');

  RETURN jsonb_build_object(
    'original_total', v_original,
    'paid_history', v_paid_history,
    'paid_installments', v_paid_installments,
    'real_balance', GREATEST(v_original - v_paid_history, 0),
    'has_active_agreement', v_active_agreements > 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_real_balance(UUID, TEXT, TEXT) TO authenticated;