ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;