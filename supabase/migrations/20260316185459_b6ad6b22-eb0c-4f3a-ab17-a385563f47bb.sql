
-- =====================================================
-- PHASE 1: DROP DANGEROUS PUBLIC POLICIES
-- =====================================================

-- 1. tenants: public SELECT with USING(true)
DROP POLICY IF EXISTS "Public can view tenant by slug" ON public.tenants;

-- 2. agreements: public SELECT with checkout_token IS NOT NULL
DROP POLICY IF EXISTS "Public can view agreement by checkout token" ON public.agreements;

-- 3. portal_payments: public SELECT via agreements join
DROP POLICY IF EXISTS "Public can view payments by checkout token" ON public.portal_payments;

-- 4. agreement_signatures: public SELECT via agreements join
DROP POLICY IF EXISTS "Public can view signatures by checkout token" ON public.agreement_signatures;

-- 5. invite_links: public SELECT for unused invites
DROP POLICY IF EXISTS "Public can view valid invite by token" ON public.invite_links;

-- =====================================================
-- PHASE 2: CREATE SECURITY DEFINER LOOKUP FUNCTIONS
-- (used by edge functions that already use service_role,
--  but also for safe public access patterns)
-- =====================================================

-- Tenant public info lookup (only safe fields)
CREATE OR REPLACE FUNCTION public.lookup_tenant_by_slug(_slug text)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  logo_url text,
  primary_color text,
  plan_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.slug, t.logo_url, t.primary_color, t.plan_id
  FROM tenants t WHERE t.slug = _slug LIMIT 1;
$$;

-- Agreement lookup by checkout token (only needed fields)
CREATE OR REPLACE FUNCTION public.lookup_agreement_by_token(_token text)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  original_total numeric,
  proposed_total numeric,
  discount_percent numeric,
  new_installments integer,
  new_installment_value numeric,
  first_due_date date,
  entrada_value numeric,
  entrada_date date,
  status text,
  checkout_token text,
  portal_origin boolean,
  notes text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.tenant_id, a.client_cpf, a.client_name, a.credor,
    a.original_total, a.proposed_total, a.discount_percent,
    a.new_installments, a.new_installment_value, a.first_due_date,
    a.entrada_value, a.entrada_date, a.status, a.checkout_token,
    a.portal_origin, a.notes
  FROM agreements a WHERE a.checkout_token = _token LIMIT 1;
$$;

-- Invite link lookup by token
CREATE OR REPLACE FUNCTION public.lookup_invite_by_token(_token text)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  role text,
  used_by uuid,
  expires_at timestamptz,
  created_by uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT il.id, il.tenant_id, il.role::text, il.used_by, il.expires_at, il.created_by
  FROM invite_links il
  WHERE il.token = _token AND il.used_by IS NULL AND il.expires_at > now()
  LIMIT 1;
$$;

-- =====================================================
-- PHASE 3: FIX OPERATOR_POINTS ESCALATION
-- =====================================================

-- Remove policies that let operators modify their own points
DROP POLICY IF EXISTS "Users can upsert own operator_points" ON public.operator_points;
DROP POLICY IF EXISTS "Users can update own operator_points" ON public.operator_points;

-- =====================================================
-- PHASE 4: FIX PAYMENT_RECORDS ESCALATION
-- =====================================================

-- Replace the ALL policy with admin-only mutations
DROP POLICY IF EXISTS "Sistema gerencia pagamentos" ON public.payment_records;

CREATE POLICY "Admins can manage payment_records"
ON public.payment_records FOR ALL
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- =====================================================
-- PHASE 5: FIX TENANT_TOKENS INSERT ESCALATION
-- =====================================================

DROP POLICY IF EXISTS "Super admin insere tokens" ON public.tenant_tokens;

CREATE POLICY "Only super admins can insert tenant_tokens"
ON public.tenant_tokens FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- =====================================================
-- PHASE 6: PERFORMANCE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_clients_tenant_status ON public.clients(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_cpf ON public.clients(tenant_id, cpf);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_credor ON public.clients(tenant_id, credor);
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_status ON public.agreements(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_agreements_checkout_token ON public.agreements(checkout_token) WHERE checkout_token IS NOT NULL;
