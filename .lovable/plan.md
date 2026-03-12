

# Plano: Criar tabelas enrichment_jobs e enrichment_logs

## Problema
As tabelas `enrichment_jobs` e `enrichment_logs` não existem no banco de dados, mas são referenciadas pelo código da higienização (EnrichmentConfirmDialog, targetdata-enrich, targetdata-webhook).

## Migração SQL

Criar duas tabelas:

### `enrichment_jobs`
- `id` UUID PK
- `tenant_id` UUID FK tenants
- `total_clients` INT
- `cost_per_client` NUMERIC
- `status` TEXT (pending, processing, completed, failed)
- `processed` INT DEFAULT 0
- `enriched` INT DEFAULT 0
- `failed` INT DEFAULT 0
- `total_cost` NUMERIC DEFAULT 0
- `created_at`, `updated_at` TIMESTAMPTZ

### `enrichment_logs`
- `id` UUID PK
- `job_id` UUID FK enrichment_jobs
- `cpf` TEXT
- `status` TEXT (success, not_found, error)
- `data_returned` JSONB
- `created_at` TIMESTAMPTZ

### RLS
- Ambas com RLS habilitado
- Políticas para tenant_users autenticados (SELECT/INSERT/UPDATE scoped por tenant_id)
- enrichment_logs: acesso via join com enrichment_jobs no tenant_id

## Nenhuma alteração de código necessária
O código já usa `as any` para contornar a tipagem — funcionará assim que as tabelas existirem.

