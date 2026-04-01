
-- Tabela de locks de atendimento
CREATE TABLE public.atendimento_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL,
  operator_name text NOT NULL DEFAULT '',
  channel text,
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '15 minutes',
  UNIQUE(tenant_id, client_id)
);

ALTER TABLE public.atendimento_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_locks_policy" ON public.atendimento_locks
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Função para limpar locks expirados
CREATE OR REPLACE FUNCTION public.cleanup_expired_locks() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ DELETE FROM public.atendimento_locks WHERE expires_at < now(); $$;
