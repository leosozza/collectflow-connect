
ALTER TABLE public.credor_agreement_templates
  ADD COLUMN IF NOT EXISTS aging_min_days integer,
  ADD COLUMN IF NOT EXISTS aging_max_days integer;

DROP FUNCTION IF EXISTS public.get_portal_agreement_templates(text, text);

CREATE OR REPLACE FUNCTION public.get_portal_agreement_templates(
  _tenant_slug text,
  _credor_name text,
  _aging_days integer DEFAULT NULL
)
RETURNS TABLE(
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
  aging_min_days integer,
  aging_max_days integer,
  allow_custom_proposal boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.nome, t.tipo, t.desconto_percent, t.parcelas, t.entrada_percent,
         t.juros_mes_percent, t.destaque, t.ordem, t.descricao,
         t.aging_min_days, t.aging_max_days,
         COALESCE(c.portal_allow_custom_proposal, true) AS allow_custom_proposal
  FROM public.credor_agreement_templates t
  JOIN public.credores c ON c.id = t.credor_id
  JOIN public.tenants tn ON tn.id = t.tenant_id
  WHERE tn.slug = _tenant_slug
    AND (c.razao_social = _credor_name OR c.nome_fantasia = _credor_name)
    AND t.ativo = true
    AND (_aging_days IS NULL OR t.aging_min_days IS NULL OR _aging_days >= t.aging_min_days)
    AND (_aging_days IS NULL OR t.aging_max_days IS NULL OR _aging_days <= t.aging_max_days)
  ORDER BY t.destaque DESC, t.ordem ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_agreement_templates(text, text, integer) TO anon, authenticated;
