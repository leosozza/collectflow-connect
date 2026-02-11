
-- Tabela para armazenar cobranças geradas via Negociarie
CREATE TABLE public.negociarie_cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  id_geral TEXT NOT NULL,
  id_parcela TEXT,
  tipo TEXT NOT NULL DEFAULT 'boleto',
  status TEXT NOT NULL DEFAULT 'pendente',
  valor NUMERIC NOT NULL,
  data_vencimento DATE NOT NULL,
  link_boleto TEXT,
  pix_copia_cola TEXT,
  link_cartao TEXT,
  linha_digitavel TEXT,
  id_status INTEGER,
  callback_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER update_negociarie_cobrancas_updated_at
  BEFORE UPDATE ON public.negociarie_cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indices
CREATE INDEX idx_negociarie_cobrancas_tenant ON public.negociarie_cobrancas(tenant_id);
CREATE INDEX idx_negociarie_cobrancas_client ON public.negociarie_cobrancas(client_id);
CREATE INDEX idx_negociarie_cobrancas_id_geral ON public.negociarie_cobrancas(id_geral);

-- RLS
ALTER TABLE public.negociarie_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view negociarie cobrancas"
  ON public.negociarie_cobrancas FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can insert negociarie cobrancas"
  ON public.negociarie_cobrancas FOR INSERT
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can update negociarie cobrancas"
  ON public.negociarie_cobrancas FOR UPDATE
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can delete negociarie cobrancas"
  ON public.negociarie_cobrancas FOR DELETE
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Policy para service_role (callback edge function) poder atualizar
CREATE POLICY "Service role can manage negociarie cobrancas"
  ON public.negociarie_cobrancas FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
