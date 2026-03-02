

## Plano: Corrigir campo `model_name` não aparecendo no perfil

### Problema
O campo `MODEL_NAME` é enriquecido corretamente durante a consulta MaxList (linhas 334-352 de `MaxListPage.tsx`), porém **nunca é incluído nos dados de inserção/upsert** enviados ao banco (linhas 464-481 e 511-531). Por isso, a coluna `model_name` fica sempre `null`.

### Solução

**`src/pages/MaxListPage.tsx`** — duas alterações:

1. **Linha ~481**: Adicionar `model_name: item.MODEL_NAME || null` ao objeto `records`
2. **Linha ~530**: Adicionar `model_name: r.model_name` ao objeto `rows` do upsert

Ambas as alterações são de uma linha cada, no mesmo arquivo.

### Arquivo
- **Editar**: `src/pages/MaxListPage.tsx`

