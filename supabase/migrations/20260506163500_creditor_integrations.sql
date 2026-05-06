-- Adicionar coluna creditor_id para suporte a faturamento direto por credor
ALTER TABLE public.tenant_integrations 
ADD COLUMN creditor_id UUID REFERENCES public.creditors(id) ON DELETE CASCADE;

-- Atualizar o índice único para permitir várias integrações por tenant, 
-- desde que sejam para credores diferentes ou para o tenant geral (null)
DROP INDEX IF EXISTS idx_tenant_integrations_unique;
CREATE UNIQUE INDEX idx_tenant_integrations_creditor_unique 
ON public.tenant_integrations (tenant_id, provider, COALESCE(creditor_id, '00000000-0000-0000-0000-000000000000'));

-- Política de RLS para que o admin do tenant possa gerenciar integrações de seus credores
CREATE POLICY "Tenant admins can manage creditor integrations"
ON public.tenant_integrations
FOR ALL
TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);

COMMENT ON COLUMN public.tenant_integrations.creditor_id IS 'Se preenchido, esta integração é exclusiva para este credor.';
