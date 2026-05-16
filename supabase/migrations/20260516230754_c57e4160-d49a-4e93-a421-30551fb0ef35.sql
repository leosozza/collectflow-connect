
-- ============================================================
-- 1) STORAGE RLS: liberar upload de logos do portal (credor-logos/)
-- ============================================================
CREATE POLICY "Authenticated can insert credor portal logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'credor-logos'
  );

CREATE POLICY "Authenticated can update credor portal logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'credor-logos'
  );

-- ============================================================
-- 2) Coluna opcional em credores
-- ============================================================
ALTER TABLE public.credores
  ADD COLUMN IF NOT EXISTS portal_allow_custom_proposal boolean NOT NULL DEFAULT true;

-- ============================================================
-- 3) Tabela credor_agreement_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credor_agreement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  credor_id uuid NOT NULL REFERENCES public.credores(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('avista','parcelado_com_entrada','parcelado_sem_entrada')),
  desconto_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (desconto_percent >= 0 AND desconto_percent <= 100),
  parcelas integer NOT NULL DEFAULT 1 CHECK (parcelas >= 1 AND parcelas <= 60),
  entrada_percent numeric(5,2) CHECK (entrada_percent IS NULL OR (entrada_percent >= 0 AND entrada_percent <= 100)),
  juros_mes_percent numeric(5,2) DEFAULT 0 CHECK (juros_mes_percent IS NULL OR juros_mes_percent >= 0),
  ativo boolean NOT NULL DEFAULT true,
  destaque boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credor_templates_credor ON public.credor_agreement_templates(credor_id, ativo, ordem);
CREATE INDEX IF NOT EXISTS idx_credor_templates_tenant ON public.credor_agreement_templates(tenant_id);

ALTER TABLE public.credor_agreement_templates ENABLE ROW LEVEL SECURITY;

-- Tenant pode gerenciar seus próprios modelos
CREATE POLICY "Tenant manages own templates"
  ON public.credor_agreement_templates
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Trigger updated_at
CREATE TRIGGER update_credor_agreement_templates_updated_at
  BEFORE UPDATE ON public.credor_agreement_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4) RPC pública para portal consumir modelos ativos
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_portal_agreement_templates(
  _tenant_slug text,
  _credor_name text
)
RETURNS TABLE (
  id uuid,
  nome text,
  tipo text,
  desconto_percent numeric,
  parcelas integer,
  entrada_percent numeric,
  juros_mes_percent numeric,
  destaque boolean,
  ordem integer,
  descricao text,
  allow_custom_proposal boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _credor_id uuid;
  _allow_custom boolean;
BEGIN
  SELECT t.id INTO _tenant_id FROM public.tenants t WHERE t.slug = _tenant_slug LIMIT 1;
  IF _tenant_id IS NULL THEN RETURN; END IF;

  SELECT c.id, COALESCE(c.portal_allow_custom_proposal, true)
    INTO _credor_id, _allow_custom
  FROM public.credores c
  WHERE c.tenant_id = _tenant_id
    AND (c.razao_social = _credor_name OR c.nome_fantasia = _credor_name)
  LIMIT 1;

  IF _credor_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT t.id, t.nome, t.tipo, t.desconto_percent, t.parcelas,
         t.entrada_percent, t.juros_mes_percent, t.destaque, t.ordem, t.descricao,
         _allow_custom
  FROM public.credor_agreement_templates t
  WHERE t.credor_id = _credor_id AND t.ativo = true
  ORDER BY t.destaque DESC, t.ordem ASC, t.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_agreement_templates(text, text) TO anon, authenticated;
