
-- Criar tabela tipos_status
CREATE TABLE public.tipos_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#6b7280',
  regras JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tipos_status ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant admins can manage tipos_status"
ON public.tipos_status
FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view tipos_status"
ON public.tipos_status
FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- Adicionar colunas na tabela clients
ALTER TABLE public.clients
  ADD COLUMN status_cobranca_id UUID REFERENCES public.tipos_status(id),
  ADD COLUMN status_cobranca_locked_by UUID,
  ADD COLUMN status_cobranca_locked_at TIMESTAMP WITH TIME ZONE;
