-- Adicionar trava para faturamento direto no cadastro do credor
ALTER TABLE public.credores 
ADD COLUMN cobrança_direta_ativa BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.credores.cobrança_direta_ativa IS 'Se verdadeiro, o sistema ignora o banco da assessoria e usa as chaves do próprio credor.';
