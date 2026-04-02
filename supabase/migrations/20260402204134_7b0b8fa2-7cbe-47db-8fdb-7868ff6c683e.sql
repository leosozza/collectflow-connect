
CREATE TABLE public.client_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  nome_completo text NOT NULL DEFAULT '',
  email text,
  phone text,
  phone2 text,
  phone3 text,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  source text DEFAULT 'system',
  source_metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, cpf)
);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.client_profiles
  FOR SELECT TO authenticated
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON public.client_profiles
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_isolation_update" ON public.client_profiles
  FOR UPDATE TO authenticated
  USING (tenant_id = get_my_tenant_id());

CREATE TRIGGER update_client_profiles_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Backfill: consolidar dados existentes da tabela clients
INSERT INTO public.client_profiles (tenant_id, cpf, nome_completo, email, phone, phone2, phone3, cep, endereco, bairro, cidade, uf, source)
SELECT DISTINCT ON (c.tenant_id, clean_cpf)
  c.tenant_id,
  clean_cpf,
  c.nome_completo,
  c.email,
  c.phone,
  c.phone2,
  c.phone3,
  c.cep,
  c.endereco,
  c.bairro,
  c.cidade,
  c.uf,
  'backfill'
FROM (
  SELECT *,
    REPLACE(REPLACE(cpf, '.', ''), '-', '') AS clean_cpf,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, REPLACE(REPLACE(cpf, '.', ''), '-', '')
      ORDER BY
        CASE WHEN email IS NOT NULL AND email != '' THEN 0 ELSE 1 END,
        CASE WHEN cep IS NOT NULL AND cep != '' THEN 0 ELSE 1 END,
        updated_at DESC
    ) AS rn
  FROM public.clients
  WHERE tenant_id IS NOT NULL
) c
WHERE c.rn = 1
ON CONFLICT (tenant_id, cpf) DO NOTHING;
