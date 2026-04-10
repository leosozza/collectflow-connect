-- Standardizing Payment Methods and Creditor-centric configuration

-- 1. Table for payment methods
CREATE TABLE IF NOT EXISTS public.meios_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credor_id UUID REFERENCES public.credores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table for integration mappings (Translator)
CREATE TABLE IF NOT EXISTS public.meio_pagamento_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credor_id UUID NOT NULL REFERENCES public.credores(id) ON DELETE CASCADE,
  external_code TEXT NOT NULL,
  internal_id UUID NOT NULL REFERENCES public.meios_pagamento(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, credor_id, external_code)
);

-- 3. Add meio_pagamento_id to clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS meio_pagamento_id UUID REFERENCES public.meios_pagamento(id) ON DELETE SET NULL;

-- 4. Add credor_id to existing config tables
ALTER TABLE public.tipos_divida 
ADD COLUMN IF NOT EXISTS credor_id UUID REFERENCES public.credores(id) ON DELETE CASCADE;

ALTER TABLE public.tipos_devedor 
ADD COLUMN IF NOT EXISTS credor_id UUID REFERENCES public.credores(id) ON DELETE CASCADE;

ALTER TABLE public.custom_fields 
ADD COLUMN IF NOT EXISTS credor_id UUID REFERENCES public.credores(id) ON DELETE CASCADE;

-- Enable RLS and set policies
ALTER TABLE public.meios_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meio_pagamento_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment methods for their tenant" 
ON public.meios_pagamento FOR SELECT 
USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage payment methods for their tenant" 
ON public.meios_pagamento FOR ALL 
USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage payment mappings for their tenant" 
ON public.meio_pagamento_mappings FOR ALL 
USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
