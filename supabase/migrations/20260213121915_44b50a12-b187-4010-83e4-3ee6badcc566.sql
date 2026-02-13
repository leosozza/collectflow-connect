
ALTER TABLE public.clients
ADD COLUMN endereco text NULL,
ADD COLUMN cidade text NULL,
ADD COLUMN uf text NULL,
ADD COLUMN cep text NULL,
ADD COLUMN observacoes text NULL;
