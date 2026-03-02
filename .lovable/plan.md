

## Plano: Corrigir busca de ModelName no endpoint batch

### Causa raiz

O endpoint `model-names` no edge function `maxsystem-proxy` faz apenas a busca em `/api/NewModelSearch` e espera encontrar `ModelName` no resultado. Porém, conforme a documentação da API MaxSystem:

- **`NewModelSearch`** (search) retorna apenas `Id`, `ContractNumber`, etc. — **sem** `ModelName`
- **`NewModelSearch/Details/{id}`** (details) é onde `ModelName` está disponível

O endpoint precisa fazer **dois passos**: buscar o `Id` do modelo e depois consultar os detalhes para obter o `ModelName`.

### Correção em `supabase/functions/maxsystem-proxy/index.ts`

Modificar o bloco `model-names` (linhas 183-194) para:

1. Chamar `/api/NewModelSearch?$top=1&$filter=(ContractNumber+eq+{cn})` para obter o `Id` do item
2. Se encontrou um item com `Id`, chamar `/api/NewModelSearch/Details/{Id}` para obter o `ModelName`
3. Armazenar `modelNames[cn] = details.ModelName`

```text
Para cada contractNumber:
  1. GET /api/NewModelSearch?$top=1&$filter=... → item.Id
  2. GET /api/NewModelSearch/Details/{item.Id} → details.ModelName
  3. modelNames[cn] = details.ModelName
```

### Arquivo
- **Editar**: `supabase/functions/maxsystem-proxy/index.ts` (linhas 183-194)

