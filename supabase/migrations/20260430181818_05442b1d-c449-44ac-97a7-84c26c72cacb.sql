-- Hotfix pontual: alinhar status_cobranca_id de Cleidson Gonçalves Rodrigues
-- (CPF 07828259662, credor TESS MODELS) para "Acordo Vigente" pois há acordo pending ativo.
UPDATE public.clients
SET status_cobranca_id = '9ffe808b-4346-4336-ba77-1fc9f56b7385',
    updated_at = now()
WHERE tenant_id = '39a450f8-7a40-46e5-8bc7-708da5043ec7'
  AND regexp_replace(cpf, '\D', '', 'g') = '07828259662'
  AND credor = 'TESS MODELS PRODUTOS FOTOGRAFICOS LTDA';