
-- =============================================
-- Sub-Fase 3B: Tabela de Acordos
-- =============================================
CREATE TABLE public.agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_cpf TEXT NOT NULL,
  client_name TEXT NOT NULL,
  credor TEXT NOT NULL,
  original_total NUMERIC NOT NULL DEFAULT 0,
  proposed_total NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  new_installments INTEGER NOT NULL DEFAULT 1,
  new_installment_value NUMERIC NOT NULL DEFAULT 0,
  first_due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  approved_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- RLS policies for agreements
CREATE POLICY "Tenant users can view agreements"
  ON public.agreements FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can insert agreements"
  ON public.agreements FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant admins can update agreements"
  ON public.agreements FOR UPDATE
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can delete agreements"
  ON public.agreements FOR DELETE
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_agreements_updated_at
  BEFORE UPDATE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Sub-Fase 3D: Tabela de Despesas
-- =============================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'operacional',
  expense_date DATE NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for expenses
CREATE POLICY "Tenant users can view expenses"
  ON public.expenses FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can update expenses"
  ON public.expenses FOR UPDATE
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can delete expenses"
  ON public.expenses FOR DELETE
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));
