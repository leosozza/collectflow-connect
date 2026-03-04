
-- 1. rivocoin_wallets
CREATE TABLE public.rivocoin_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, profile_id)
);
ALTER TABLE public.rivocoin_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON public.rivocoin_wallets FOR SELECT USING (profile_id = get_my_profile_id() AND tenant_id = get_my_tenant_id());
CREATE POLICY "Tenant admins can manage wallets" ON public.rivocoin_wallets FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid())) WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can update own wallet" ON public.rivocoin_wallets FOR UPDATE USING (profile_id = get_my_profile_id() AND tenant_id = get_my_tenant_id());
CREATE POLICY "Users can insert own wallet" ON public.rivocoin_wallets FOR INSERT WITH CHECK (profile_id = get_my_profile_id() AND tenant_id = get_my_tenant_id());

-- 2. rivocoin_transactions
CREATE TABLE public.rivocoin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'earn',
  description text,
  reference_type text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rivocoin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.rivocoin_transactions FOR SELECT USING (profile_id = get_my_profile_id() AND tenant_id = get_my_tenant_id());
CREATE POLICY "Tenant admins can manage transactions" ON public.rivocoin_transactions FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid())) WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can insert own transactions" ON public.rivocoin_transactions FOR INSERT WITH CHECK (profile_id = get_my_profile_id() AND tenant_id = get_my_tenant_id());

-- 3. shop_products
CREATE TABLE public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  description text,
  image_url text,
  price_rivocoins integer NOT NULL DEFAULT 0,
  stock integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active products" ON public.shop_products FOR SELECT USING (tenant_id = get_my_tenant_id() AND is_active = true);
CREATE POLICY "Tenant admins can manage products" ON public.shop_products FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid())) WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- 4. shop_orders
CREATE TABLE public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.shop_products(id),
  price_paid integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON public.shop_orders FOR SELECT USING (profile_id = get_my_profile_id() AND tenant_id = get_my_tenant_id());
CREATE POLICY "Users can insert own orders" ON public.shop_orders FOR INSERT WITH CHECK (profile_id = get_my_profile_id() AND tenant_id = get_my_tenant_id());
CREATE POLICY "Tenant admins can manage orders" ON public.shop_orders FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid())) WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- 5. ranking_configs
CREATE TABLE public.ranking_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  metric text NOT NULL DEFAULT 'points',
  period text NOT NULL DEFAULT 'mensal',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ranking_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ranking configs" ON public.ranking_configs FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "Tenant admins can manage ranking configs" ON public.ranking_configs FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid())) WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));
