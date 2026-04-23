
CREATE TABLE IF NOT EXISTS public.integration_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  tenant_id uuid NULL,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS integration_tokens_provider_tenant_idx
  ON public.integration_tokens (provider, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role bypasses RLS and can read/write.

CREATE TRIGGER trg_integration_tokens_updated_at
BEFORE UPDATE ON public.integration_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime for negociarie_cobrancas (so the Acordos tab updates when boletos appear in background)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'negociarie_cobrancas'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.negociarie_cobrancas';
  END IF;
END $$;

ALTER TABLE public.negociarie_cobrancas REPLICA IDENTITY FULL;
