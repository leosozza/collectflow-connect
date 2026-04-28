-- Tabela isolada para contas de cobrança da plataforma (cobrar tenants)
CREATE TABLE IF NOT EXISTS public.platform_billing_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'asaas',
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  account_label TEXT NOT NULL DEFAULT 'Asaas Plataforma',
  wallet_id TEXT,
  webhook_token TEXT DEFAULT gen_random_uuid()::text,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_test_message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas uma conta ativa por (provider, environment)
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_billing_provider_env_active
  ON public.platform_billing_accounts (provider, environment)
  WHERE is_active = true;

ALTER TABLE public.platform_billing_accounts ENABLE ROW LEVEL SECURITY;

-- Política: somente super admins
DROP POLICY IF EXISTS "Super admins can view platform billing accounts" ON public.platform_billing_accounts;
CREATE POLICY "Super admins can view platform billing accounts"
  ON public.platform_billing_accounts
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can insert platform billing accounts" ON public.platform_billing_accounts;
CREATE POLICY "Super admins can insert platform billing accounts"
  ON public.platform_billing_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can update platform billing accounts" ON public.platform_billing_accounts;
CREATE POLICY "Super admins can update platform billing accounts"
  ON public.platform_billing_accounts
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can delete platform billing accounts" ON public.platform_billing_accounts;
CREATE POLICY "Super admins can delete platform billing accounts"
  ON public.platform_billing_accounts
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_platform_billing_accounts_updated_at ON public.platform_billing_accounts;
CREATE TRIGGER trg_platform_billing_accounts_updated_at
  BEFORE UPDATE ON public.platform_billing_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial (sandbox)
INSERT INTO public.platform_billing_accounts (provider, environment, account_label, is_active)
SELECT 'asaas', 'sandbox', 'Asaas Plataforma (Sandbox)', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_billing_accounts WHERE provider='asaas' AND environment='sandbox'
);