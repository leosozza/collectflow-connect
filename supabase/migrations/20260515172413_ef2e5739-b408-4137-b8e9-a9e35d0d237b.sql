-- Tabela de alertas de conciliação Maxlist → Acordo
CREATE TABLE IF NOT EXISTS public.agreement_reconciliation_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  installment_id UUID REFERENCES public.agreement_installments(id) ON DELETE SET NULL,
  installment_key TEXT,
  client_cpf TEXT NOT NULL,
  credor TEXT NOT NULL,
  maxlist_payment_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  maxlist_payment_date DATE,
  maxlist_source_ref TEXT NOT NULL,
  maxlist_source_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','pending_admin_approval','resolved_confirmed','resolved_ignored')),
  linked_manual_payment_id UUID REFERENCES public.manual_payments(id) ON DELETE SET NULL,
  assigned_operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Idempotência: 1 alerta por pagamento Maxlist por acordo
CREATE UNIQUE INDEX IF NOT EXISTS uq_recon_alert_agreement_source
  ON public.agreement_reconciliation_alerts (agreement_id, maxlist_source_ref);

CREATE INDEX IF NOT EXISTS idx_recon_alert_tenant_status
  ON public.agreement_reconciliation_alerts (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_recon_alert_agreement_status
  ON public.agreement_reconciliation_alerts (agreement_id, status);

CREATE INDEX IF NOT EXISTS idx_recon_alert_installment
  ON public.agreement_reconciliation_alerts (installment_id);

ALTER TABLE public.agreement_reconciliation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recon_alert_select_tenant"
  ON public.agreement_reconciliation_alerts FOR SELECT
  USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "recon_alert_insert_tenant"
  ON public.agreement_reconciliation_alerts FOR INSERT
  WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "recon_alert_update_tenant"
  ON public.agreement_reconciliation_alerts FOR UPDATE
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "recon_alert_delete_admin"
  ON public.agreement_reconciliation_alerts FOR DELETE
  USING (tenant_id = public.get_my_tenant_id() AND public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER trg_recon_alert_updated_at
BEFORE UPDATE ON public.agreement_reconciliation_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vínculo opcional manual_payments -> alerta
ALTER TABLE public.manual_payments
  ADD COLUMN IF NOT EXISTS reconciliation_alert_id UUID
    REFERENCES public.agreement_reconciliation_alerts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_manual_payments_recon_alert
  ON public.manual_payments(reconciliation_alert_id)
  WHERE reconciliation_alert_id IS NOT NULL;

-- RPC: cria alertas em lote a partir do maxlist-import (service_role only via edge)
CREATE OR REPLACE FUNCTION public.create_reconciliation_alerts_from_maxlist(
  _tenant_id UUID,
  _payments JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment JSONB;
  _agreement_id UUID;
  _installment RECORD;
  _inserted INTEGER := 0;
  _cpf_norm TEXT;
BEGIN
  FOR _payment IN SELECT * FROM jsonb_array_elements(_payments)
  LOOP
    _cpf_norm := regexp_replace(COALESCE(_payment->>'cpf',''), '\D', '', 'g');
    IF _cpf_norm = '' OR (_payment->>'credor') IS NULL THEN
      CONTINUE;
    END IF;

    -- Encontra acordo ativo do CPF+Credor
    SELECT id INTO _agreement_id
    FROM public.agreements
    WHERE tenant_id = _tenant_id
      AND regexp_replace(client_cpf, '\D', '', 'g') = _cpf_norm
      AND credor = (_payment->>'credor')
      AND status IN ('approved','overdue')
    ORDER BY created_at DESC
    LIMIT 1;

    IF _agreement_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Próxima parcela em aberto (menor seq, não paga, não cancelada)
    SELECT id, installment_key INTO _installment
    FROM public.agreement_installments
    WHERE agreement_id = _agreement_id
      AND paid = false
      AND cancelled = false
      AND pending_confirmation = false
    ORDER BY seq ASC
    LIMIT 1;

    IF _installment.id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.agreement_reconciliation_alerts (
      tenant_id, agreement_id, installment_id, installment_key,
      client_cpf, credor, maxlist_payment_value, maxlist_payment_date,
      maxlist_source_ref, maxlist_source_meta
    ) VALUES (
      _tenant_id, _agreement_id, _installment.id, _installment.installment_key,
      _cpf_norm, _payment->>'credor',
      COALESCE((_payment->>'valor_pago')::numeric, 0),
      NULLIF(_payment->>'data_pagamento','')::date,
      _payment->>'source_ref',
      COALESCE(_payment->'meta', '{}'::jsonb)
    )
    ON CONFLICT (agreement_id, maxlist_source_ref) DO NOTHING;

    IF FOUND THEN
      _inserted := _inserted + 1;
    END IF;
  END LOOP;

  RETURN _inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reconciliation_alerts_from_maxlist(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reconciliation_alerts_from_maxlist(UUID, JSONB) TO service_role;