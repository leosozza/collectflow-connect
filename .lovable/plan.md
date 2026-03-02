

## Plano: Incluir "Nome do Modelo" (ModelName) nos dados do MaxList

O campo ModelName nao vem no endpoint de Installments do MaxSystem. Ele requer chamadas separadas via `model-search` por ContractNumber. O plano e enriquecer os dados apos a busca de parcelas.

### Alteracoes

**`supabase/functions/maxsystem-proxy/index.ts`**:
1. Adicionar nova action `model-names` que recebe uma lista de ContractNumbers via POST body
2. Para cada contrato unico, chamar `NewModelSearch` e extrair o campo de nome do modelo
3. Retornar um mapa `{ [contractNumber]: modelName }`

**`src/pages/MaxListPage.tsx`**:
1. Adicionar campo `MODEL_NAME` na interface `MappedRecord`
2. Apos buscar os installments, coletar os ContractNumbers unicos
3. Chamar a nova action `model-names` com os contratos unicos
4. Preencher o campo `MODEL_NAME` em cada registro mapeado
5. O campo ficara disponivel no dialog de mapeamento para vincular ao campo personalizado "Nome do Modelo"

### Fluxo
```text
1. Usuario busca parcelas (installments)
2. Frontend coleta ContractNumbers unicos dos resultados
3. POST /maxsystem-proxy?action=model-names com lista de contratos
4. Proxy busca nome do modelo para cada contrato (em paralelo, lotes de 10)
5. Frontend adiciona MODEL_NAME a cada registro
6. No mapeamento, MODEL_NAME aparece como coluna disponivel
```

### Arquivos
- **Editar**: `supabase/functions/maxsystem-proxy/index.ts` (nova action)
- **Editar**: `src/pages/MaxListPage.tsx` (enriquecer dados com ModelName)

