-- Clientes e assinaturas Asaas usados pela plataforma para cobrar tenants.
-- Mantem esses registros isolados das integracoes Asaas configuradas pelos tenants.

WITH ranked_accounts AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY provider ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM public.platform_billing_accounts
  WHERE is_active = true
)
UPDATE public.platform_billing_accounts pba
SET is_active = false
FROM ranked_accounts ranked
WHERE pba.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_billing_provider_active
  ON public.platform_billing_accounts (provider)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.platform_billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform_account_id UUID NOT NULL REFERENCES public.platform_billing_accounts(id) ON DELETE RESTRICT,
  asaas_customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  raw_response JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_billing_customers_tenant_account_key UNIQUE (tenant_id, platform_account_id),
  CONSTRAINT platform_billing_customers_asaas_customer_key UNIQUE (asaas_customer_id)
);

CREATE TABLE IF NOT EXISTS public.platform_billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  platform_account_id UUID NOT NULL REFERENCES public.platform_billing_accounts(id) ON DELETE RESTRICT,
  platform_customer_id UUID NOT NULL REFERENCES public.platform_billing_customers(id) ON DELETE RESTRICT,
  asaas_subscription_id TEXT NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('BOLETO', 'PIX', 'CREDIT_CARD', 'UNDEFINED')),
  cycle TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (cycle IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY')),
  value NUMERIC(10,2) NOT NULL CHECK (value > 0),
  next_due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  description TEXT,
  external_reference TEXT,
  last_payment_id TEXT,
  last_payment_status TEXT,
  last_payment_due_date DATE,
  last_payment_at TIMESTAMPTZ,
  raw_response JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_billing_subscriptions_asaas_subscription_key UNIQUE (asaas_subscription_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_billing_active_subscription
  ON public.platform_billing_subscriptions (tenant_id, platform_account_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_platform_billing_customers_tenant
  ON public.platform_billing_customers (tenant_id);

CREATE INDEX IF NOT EXISTS idx_platform_billing_subscriptions_tenant
  ON public.platform_billing_subscriptions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_platform_billing_subscriptions_status
  ON public.platform_billing_subscriptions (status);

ALTER TABLE public.platform_billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_billing_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage platform billing customers" ON public.platform_billing_customers;
CREATE POLICY "Super admins can manage platform billing customers"
  ON public.platform_billing_customers
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can manage platform billing subscriptions" ON public.platform_billing_subscriptions;
CREATE POLICY "Super admins can manage platform billing subscriptions"
  ON public.platform_billing_subscriptions
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_platform_billing_customers_updated_at ON public.platform_billing_customers;
CREATE TRIGGER trg_platform_billing_customers_updated_at
  BEFORE UPDATE ON public.platform_billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_platform_billing_subscriptions_updated_at ON public.platform_billing_subscriptions;
CREATE TRIGGER trg_platform_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.platform_billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
