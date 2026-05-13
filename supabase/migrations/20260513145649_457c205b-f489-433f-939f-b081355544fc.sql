CREATE INDEX IF NOT EXISTS idx_clients_tenant_cpfnorm_credor
  ON public.clients (tenant_id, (regexp_replace(cpf, '\D', '', 'g')), credor);

CREATE INDEX IF NOT EXISTS idx_agreements_tenant_cpfnorm_credor
  ON public.agreements (tenant_id, (regexp_replace(client_cpf, '\D', '', 'g')), credor);

DROP FUNCTION IF EXISTS public.run_ssot_shadow_check(uuid);