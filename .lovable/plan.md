

# Remover 3 índices redundantes do banco de dados

## Alteração

Uma única migration SQL para dropar os 3 índices identificados como seguros para remoção:

```sql
DROP INDEX IF EXISTS idx_clients_nome_completo_trgm;  -- 25 MB, 0 scans
DROP INDEX IF EXISTS idx_clients_external_id;          -- 19 MB, 10 scans (coberto pelo UNIQUE constraint)
DROP INDEX IF EXISTS idx_clients_credor;               -- 3 MB, 0 scans (coberto pelo idx_clients_tenant_credor)
```

**Resultado**: ~47 MB liberados + INSERTs/UPDATEs mais rápidos nas importações.

Nenhuma alteração de código é necessária — nenhum desses índices é referenciado no código da aplicação.

