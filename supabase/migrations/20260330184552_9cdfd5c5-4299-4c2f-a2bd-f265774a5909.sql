
-- Tabela de templates WhatsApp reutilizáveis
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cobranca',
  message_body TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Vincular instância à régua de cobrança
ALTER TABLE public.collection_rules
  ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL;
