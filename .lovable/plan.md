

## Problema Identificado

O erro do banco de dados é: **"ON CONFLICT DO UPDATE command cannot affect row a second time"**.

Isso ocorre porque dentro do mesmo batch de 500 registros, existem `external_id` duplicados. Na linha 539, quando o `external_id` não vem da API, o fallback gera `${cod_contrato}-${numero_parcela}`, e se dois registros tiverem o mesmo contrato e parcela (ou ambos vazios), o Postgres rejeita o batch inteiro.

## Solução

### `src/pages/MaxListPage.tsx`

**1. Deduplicar registros antes do upsert:**
Após filtrar os registros válidos (com CPF e nome), agrupar por `external_id` mantendo apenas o último registro de cada chave. Isso evita duplicatas dentro do mesmo batch.

**2. Melhorar o fallback de `external_id`:**
Usar `cod_titulo` (campo `Id` da API) como fonte primária do external_id, pois é o identificador único real do título no MaxSystem. Fallback atual `${cod_contrato}-${numero_parcela}` é fraco demais.

Nova lógica (linha ~539):
```
external_id = record.cod_titulo 
  ? String(record.cod_titulo) 
  : record.external_id 
    ? String(record.external_id) 
    : `${record.cod_contrato || ""}-${record.numero_parcela || 1}`
```

**3. Reduzir BATCH_SIZE de 500 para 200:**
Menor chance de colisão dentro do batch e mensagens de erro mais granulares.

**4. Adicionar deduplicação por `external_id` antes de enviar cada batch:**
```typescript
// Deduplicate by external_id, keeping last occurrence
const deduplicated = [...new Map(records.map(r => [r.external_id, r])).values()];
```

Registros duplicados removidos serão contabilizados no relatório.

### Resultado
Os 537 registros devem ser processados corretamente, sem erros de conflito de chave duplicada dentro do mesmo batch.

