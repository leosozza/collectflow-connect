-- Adiciona vínculo opcional de chave de API com credor
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS credor_id uuid REFERENCES public.credores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_api_keys_credor
  ON public.api_keys(credor_id)
  WHERE credor_id IS NOT NULL;

COMMENT ON COLUMN public.api_keys.credor_id IS
  'Quando preenchido, escopa a chave a um único credor. NULL = chave do tenant inteiro (acessa todos os credores).';