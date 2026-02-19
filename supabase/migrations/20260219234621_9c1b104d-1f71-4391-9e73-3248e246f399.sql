
-- Drop the partial unique index (doesn't work with PostgREST upsert)
DROP INDEX IF EXISTS clients_external_id_tenant_id_unique;

-- Create a proper UNIQUE constraint that PostgREST can use
ALTER TABLE public.clients ADD CONSTRAINT clients_external_id_tenant_id_key UNIQUE (external_id, tenant_id);
