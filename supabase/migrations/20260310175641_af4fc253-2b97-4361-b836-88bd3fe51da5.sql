
-- 1. System Settings table (global key-value for super_admin)
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage system_settings"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Seed default: sandbox
INSERT INTO public.system_settings (key, value) VALUES ('asaas_environment', 'sandbox');

-- 2. Asaas Customers table
CREATE TABLE public.asaas_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asaas_customer_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text,
  cpf_cnpj text NOT NULL,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage asaas_customers"
  ON public.asaas_customers FOR ALL
  TO authenticated
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view asaas_customers"
  ON public.asaas_customers FOR SELECT
  TO authenticated
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- 3. Add Asaas columns to payment_records
ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS asaas_payment_id text,
  ADD COLUMN IF NOT EXISTS billing_type text,
  ADD COLUMN IF NOT EXISTS asaas_status text,
  ADD COLUMN IF NOT EXISTS pix_qr_code text,
  ADD COLUMN IF NOT EXISTS pix_copy_paste text,
  ADD COLUMN IF NOT EXISTS boleto_url text,
  ADD COLUMN IF NOT EXISTS due_date date;
