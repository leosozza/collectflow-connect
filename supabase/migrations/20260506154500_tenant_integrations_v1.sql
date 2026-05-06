
-- =============================================
-- TABELA: tenant_integrations
-- Armazena credenciais específicas de cada tenant (Negociarie, Asaas de cobrança, etc)
-- =============================================
CREATE TABLE IF NOT EXISTS public.tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'negociarie', 'asaas', 'gupshup', etc.
  config JSONB NOT NULL DEFAULT '{}', -- Armazena { api_key, client_id, etc }
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, provider)
);

-- Habilitar RLS
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Tenant users can view own integrations" 
ON public.tenant_integrations FOR SELECT 
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage own integrations" 
ON public.tenant_integrations FOR ALL 
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_tenant_integrations_timestamp
BEFORE UPDATE ON public.tenant_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- REFORÇO DE ISOLAMENTO (BACKFILL E NOT NULL)
-- =============================================

-- 1. Garantir que o tenant padrão existe (YBRASIL / Default)
-- O ID '00000000-0000-0000-0000-000000000001' já foi usado em migrations anteriores.
DO $$
DECLARE
    default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Backfill preventivo em tabelas que podem ter tenant_id nulo
    UPDATE public.clients SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.profiles SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.agreements SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    
    -- Tornar tenant_id obrigatório onde ainda não for
    ALTER TABLE public.clients ALTER COLUMN tenant_id SET NOT NULL;
    ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
END $$;
