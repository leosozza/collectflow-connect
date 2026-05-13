ALTER TABLE public.clients ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.agreements ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.negociarie_cobrancas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.manual_payments ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_neg_cob_tenant_agr_key
  ON public.negociarie_cobrancas (tenant_id, agreement_id, installment_key);

CREATE INDEX IF NOT EXISTS idx_neg_cob_tenant_venc
  ON public.negociarie_cobrancas (tenant_id, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_neg_cob_tenant_status
  ON public.negociarie_cobrancas (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_neg_cob_tenant_client
  ON public.negociarie_cobrancas (tenant_id, client_id);

CREATE INDEX IF NOT EXISTS idx_manual_pay_tenant_agr_key
  ON public.manual_payments (tenant_id, agreement_id, installment_key)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_manual_pay_tenant_paydate
  ON public.manual_payments (tenant_id, payment_date)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_agreements_tenant_client_status
  ON public.agreements (tenant_id, client_cpf, status);