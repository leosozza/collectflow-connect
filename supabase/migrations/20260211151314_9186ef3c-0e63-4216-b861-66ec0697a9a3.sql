
-- Tabela de regras de cobrança por tenant
CREATE TABLE public.collection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','email','both')),
  days_offset INTEGER NOT NULL DEFAULT 0,
  message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de log de mensagens enviadas
CREATE TABLE public.message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES public.collection_rules(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  phone TEXT,
  email_to TEXT,
  message_body TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.collection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- collection_rules: tenant users can view
CREATE POLICY "Tenant users can view collection rules"
ON public.collection_rules FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- collection_rules: tenant admins can manage
CREATE POLICY "Tenant admins can manage collection rules"
ON public.collection_rules FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- message_logs: tenant users can view
CREATE POLICY "Tenant users can view message logs"
ON public.message_logs FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- message_logs: tenant admins can insert (for manual sends)
CREATE POLICY "Tenant admins can insert message logs"
ON public.message_logs FOR INSERT
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Trigger for updated_at on collection_rules
CREATE TRIGGER update_collection_rules_updated_at
BEFORE UPDATE ON public.collection_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
