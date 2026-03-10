
-- ============================================
-- TABELA: service_catalog
-- ============================================
CREATE TABLE public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_type TEXT NOT NULL DEFAULT 'fixed',
  unit_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  category TEXT NOT NULL DEFAULT 'general',
  tokens_required INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABELA: tenant_services
-- ============================================
CREATE TABLE public.tenant_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.service_catalog(id),
  status TEXT NOT NULL DEFAULT 'active',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_override DECIMAL(10,2),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT unique_tenant_service UNIQUE (tenant_id, service_id)
);

CREATE INDEX idx_tenant_services_tenant ON public.tenant_services(tenant_id);
CREATE INDEX idx_tenant_services_status ON public.tenant_services(status);

CREATE TRIGGER update_tenant_services_timestamp
  BEFORE UPDATE ON public.tenant_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: tenant_tokens
-- ============================================
CREATE TABLE public.tenant_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_balance INTEGER NOT NULL DEFAULT 0 CHECK (token_balance >= 0),
  reserved_balance INTEGER NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),
  lifetime_purchased INTEGER NOT NULL DEFAULT 0,
  lifetime_consumed INTEGER NOT NULL DEFAULT 0,
  low_balance_threshold INTEGER DEFAULT 100,
  auto_recharge_enabled BOOLEAN DEFAULT FALSE,
  auto_recharge_amount INTEGER,
  last_purchase_at TIMESTAMPTZ,
  last_consumption_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_tokens_balance ON public.tenant_tokens(token_balance);

CREATE TRIGGER update_tenant_tokens_timestamp
  BEFORE UPDATE ON public.tenant_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: token_packages
-- ============================================
CREATE TABLE public.token_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  token_amount INTEGER NOT NULL,
  bonus_tokens INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABELA: token_transactions
-- ============================================
CREATE TABLE public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  service_code TEXT,
  reference_id TEXT,
  reference_type TEXT,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_token_transactions_tenant ON public.token_transactions(tenant_id);
CREATE INDEX idx_token_transactions_type ON public.token_transactions(transaction_type);
CREATE INDEX idx_token_transactions_created ON public.token_transactions(created_at DESC);
CREATE INDEX idx_token_transactions_service ON public.token_transactions(service_code);

-- ============================================
-- TABELA: service_usage_logs
-- ============================================
CREATE TABLE public.service_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  tokens_consumed INTEGER NOT NULL DEFAULT 0,
  usage_type TEXT NOT NULL,
  target_entity_type TEXT,
  target_entity_id UUID,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_service_usage_tenant ON public.service_usage_logs(tenant_id);
CREATE INDEX idx_service_usage_service ON public.service_usage_logs(service_code);
CREATE INDEX idx_service_usage_created ON public.service_usage_logs(created_at DESC);

-- ============================================
-- TABELA: payment_records
-- ============================================
CREATE TABLE public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_gateway TEXT,
  gateway_transaction_id TEXT,
  gateway_response JSONB DEFAULT '{}',
  token_package_id UUID REFERENCES public.token_packages(id),
  tokens_granted INTEGER,
  invoice_url TEXT,
  invoice_pdf_url TEXT,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_payment_records_tenant ON public.payment_records(tenant_id);
CREATE INDEX idx_payment_records_status ON public.payment_records(status);
CREATE INDEX idx_payment_records_created ON public.payment_records(created_at DESC);

CREATE TRIGGER update_payment_records_timestamp
  BEFORE UPDATE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- service_catalog
CREATE POLICY "Todos podem ver catalogo ativo" ON public.service_catalog
  FOR SELECT USING (is_active = TRUE OR is_super_admin(auth.uid()));

CREATE POLICY "Super admin gerencia catalogo" ON public.service_catalog
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- token_packages
CREATE POLICY "Todos podem ver pacotes ativos" ON public.token_packages
  FOR SELECT USING (is_active = TRUE OR is_super_admin(auth.uid()));

CREATE POLICY "Super admin gerencia pacotes" ON public.token_packages
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- tenant_services
CREATE POLICY "Tenant ve proprios servicos" ON public.tenant_services
  FOR SELECT USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Admin ativa servicos" ON public.tenant_services
  FOR ALL USING (
    (tenant_id = get_my_tenant_id() AND is_tenant_admin(auth.uid(), tenant_id))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (tenant_id = get_my_tenant_id() AND is_tenant_admin(auth.uid(), tenant_id))
    OR is_super_admin(auth.uid())
  );

-- tenant_tokens
CREATE POLICY "Tenant ve proprios tokens" ON public.tenant_tokens
  FOR SELECT USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Sistema atualiza tokens" ON public.tenant_tokens
  FOR UPDATE USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Super admin insere tokens" ON public.tenant_tokens
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()) OR tenant_id = get_my_tenant_id());

-- token_transactions
CREATE POLICY "Tenant ve proprias transacoes" ON public.token_transactions
  FOR SELECT USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Sistema insere transacoes" ON public.token_transactions
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- service_usage_logs
CREATE POLICY "Tenant ve proprios logs" ON public.service_usage_logs
  FOR SELECT USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Sistema insere logs" ON public.service_usage_logs
  FOR INSERT WITH CHECK (TRUE);

-- payment_records
CREATE POLICY "Tenant ve proprios pagamentos" ON public.payment_records
  FOR SELECT USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Sistema gerencia pagamentos" ON public.payment_records
  FOR ALL USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Consumir tokens (atômica)
CREATE OR REPLACE FUNCTION consume_tokens(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_service_code TEXT,
  p_description TEXT,
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  transaction_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  SELECT token_balance INTO v_current_balance
  FROM tenant_tokens WHERE tenant_id = p_tenant_id FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, NULL::UUID, 'Tenant não possui conta de tokens'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT FALSE, v_current_balance, NULL::UUID, 'Saldo insuficiente de tokens'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE tenant_tokens
  SET token_balance = v_new_balance,
      lifetime_consumed = lifetime_consumed + p_amount,
      last_consumption_at = NOW(),
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO token_transactions (
    tenant_id, amount, balance_after, transaction_type,
    service_code, reference_id, reference_type, description,
    metadata, created_by
  ) VALUES (
    p_tenant_id, -p_amount, v_new_balance, 'consumption',
    p_service_code, p_reference_id, p_reference_type,
    p_description, p_metadata, auth.uid()
  ) RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT TRUE, v_new_balance, v_transaction_id, NULL::TEXT;
END;
$$;

-- Adicionar tokens (compra/bônus)
CREATE OR REPLACE FUNCTION add_tokens(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_description TEXT,
  p_reference_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  transaction_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  INSERT INTO tenant_tokens (tenant_id, token_balance)
  VALUES (p_tenant_id, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  UPDATE tenant_tokens
  SET token_balance = token_balance + p_amount,
      lifetime_purchased = CASE WHEN p_transaction_type = 'purchase' THEN lifetime_purchased + p_amount ELSE lifetime_purchased END,
      last_purchase_at = CASE WHEN p_transaction_type = 'purchase' THEN NOW() ELSE last_purchase_at END,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id
  RETURNING token_balance INTO v_new_balance;

  INSERT INTO token_transactions (
    tenant_id, amount, balance_after, transaction_type,
    reference_id, description, metadata, created_by
  ) VALUES (
    p_tenant_id, p_amount, v_new_balance, p_transaction_type,
    p_reference_id, p_description, p_metadata, auth.uid()
  ) RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT TRUE, v_new_balance, v_transaction_id, NULL::TEXT;
END;
$$;

-- Verificar saldo
CREATE OR REPLACE FUNCTION check_token_balance(
  p_tenant_id UUID,
  p_required_amount INTEGER
)
RETURNS TABLE (
  has_sufficient_balance BOOLEAN,
  current_balance INTEGER,
  shortfall INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT token_balance INTO v_balance FROM tenant_tokens WHERE tenant_id = p_tenant_id;
  IF v_balance IS NULL THEN v_balance := 0; END IF;
  RETURN QUERY SELECT v_balance >= p_required_amount, v_balance, GREATEST(p_required_amount - v_balance, 0);
END;
$$;

-- Resumo de tokens do tenant
CREATE OR REPLACE FUNCTION get_tenant_token_summary(p_tenant_id UUID)
RETURNS TABLE (
  balance INTEGER,
  reserved INTEGER,
  available INTEGER,
  total_purchased INTEGER,
  total_consumed INTEGER,
  last_30_days_consumed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tt.token_balance,
    tt.reserved_balance,
    tt.token_balance - tt.reserved_balance,
    tt.lifetime_purchased,
    tt.lifetime_consumed,
    COALESCE((
      SELECT SUM(ABS(t.amount))::INTEGER
      FROM token_transactions t
      WHERE t.tenant_id = p_tenant_id
        AND t.transaction_type = 'consumption'
        AND t.created_at >= NOW() - INTERVAL '30 days'
    ), 0)
  FROM tenant_tokens tt
  WHERE tt.tenant_id = p_tenant_id;
END;
$$;

-- ============================================
-- DADOS INICIAIS: Catálogo de Serviços
-- ============================================
INSERT INTO public.service_catalog (service_code, name, description, price, price_type, unit_label, category, icon, display_order, tokens_required) VALUES
  ('crm', 'CRM', 'Sistema completo de gestão de relacionamento com clientes', 499.90, 'monthly', NULL, 'core', 'Users', 1, 0),
  ('whatsapp_instance', 'Instância de WhatsApp', 'Canal de comunicação via WhatsApp Business', 99.00, 'per_unit', 'por instância', 'core', 'MessageCircle', 2, 0),
  ('ai_agent_cobranca', 'Agente de IA Digital Cobrança', 'Agente inteligente para cobrança automatizada', 99.00, 'monthly', NULL, 'ai_agent', 'Bot', 3, 1),
  ('ai_agent_voip', 'Agente de IA Digital Voip', 'Agente inteligente para atendimento via voz', 99.99, 'monthly', NULL, 'ai_agent', 'Phone', 4, 1),
  ('assinatura_digital', 'Assinatura Digital', 'Assinatura eletrônica de documentos', 49.99, 'monthly', NULL, 'addon', 'PenTool', 5, 0),
  ('negativacao_serasa', 'Negativação Serasa', 'Negativação de devedores junto ao Serasa', 10.00, 'per_unit', 'por negativação', 'integration', 'AlertTriangle', 6, 0),
  ('protesto_cartorio', 'Protesto em Cartório', 'Protesto de títulos em cartório', 0.00, 'per_unit', 'por protesto', 'integration', 'FileWarning', 7, 0),
  ('higienizacao_base', 'Higienização de Base', 'Limpeza e enriquecimento de dados cadastrais', 0.00, 'per_unit', 'por registro', 'addon', 'Database', 8, 0);

-- ============================================
-- DADOS INICIAIS: Pacotes de Tokens
-- ============================================
INSERT INTO public.token_packages (name, description, token_amount, bonus_tokens, price, discount_percentage, is_featured, display_order) VALUES
  ('Starter', 'Ideal para começar', 100, 0, 50.00, 0, FALSE, 1),
  ('Básico', 'Para uso moderado', 500, 25, 225.00, 10, FALSE, 2),
  ('Popular', 'Melhor custo-benefício', 1000, 100, 400.00, 20, TRUE, 3),
  ('Profissional', 'Para alta demanda', 2500, 375, 875.00, 30, FALSE, 4),
  ('Enterprise', 'Para grandes operações', 5000, 1000, 1500.00, 40, FALSE, 5);
