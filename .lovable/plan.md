

## Plano: 3 Correções — Limite de registros, exclusão de carteira e model_name

### 1. Aumentar limite de preview de 500 para 1000 registros

**Arquivo**: `src/pages/MaxListPage.tsx`

- Linha 54: `BATCH_SIZE = 500` → `BATCH_SIZE = 1000` (se usado)
- Linha 272: `data.slice(0, 500)` → `data.slice(0, 1000)`
- Linha 847: Mensagem "Mostrando 500 de..." → "Mostrando 1000 de..."

### 2. Corrigir exclusão em massa na Carteira

O problema é que o `.in("id", ids)` com muitos IDs (980+) pode falhar. A correção é dividir em lotes de 100.

**Arquivo**: `src/pages/CarteiraPage.tsx` (linhas 400-406)

Substituir a chamada única por um loop em batches:

```typescript
const ids = Array.from(selectedIds);
const batchSize = 100;
for (let i = 0; i < ids.length; i += batchSize) {
  const batch = ids.slice(i, i + batchSize);
  const { error: deleteError } = await supabase
    .from("clients")
    .delete()
    .in("id", batch);
  if (deleteError) throw deleteError;
}
```

### 3. Remover MODEL_NAME do card de importação MaxList

O usuário quer gerenciar "Nome do Modelo" como campo personalizado, não como campo fixo.

**Arquivo**: `src/pages/MaxListPage.tsx`

- Remover `MODEL_NAME` da interface `MappedRecord` (linha 101)
- Remover `MODEL_NAME: ""` do `mapItem` (linha 151)
- Remover o bloco de enriquecimento com `model-names` (linhas 334-358)
- Remover `model_name: item.MODEL_NAME || null` do record de upsert (linha 481)
- Remover `"MODEL_NAME"` do array `sourceHeaders` do `MaxListMappingDialog` (linha 860)

### 4. Corrigir busca de ModelName no edge function (para uso futuro via campos personalizados)

**Arquivo**: `supabase/functions/maxsystem-proxy/index.ts` (linha 186)

O `ContractNumber` é string na API MaxSystem — precisa de aspas simples no filtro:

```
Antes:  (ContractNumber+eq+${cn})
Depois: (ContractNumber+eq+'${cn}')
```

Mesma correção na linha 112 (ação `model-search`):
```
Antes:  (ContractNumber+eq+${contractNumber})
Depois: (ContractNumber+eq+'${contractNumber}')
```

### Resumo de arquivos

| Arquivo | Alteração |
|---|---|
| `src/pages/MaxListPage.tsx` | Limite 500→1000, remover MODEL_NAME do fluxo |
| `src/pages/CarteiraPage.tsx` | Batch delete em lotes de 100 |
| `supabase/functions/maxsystem-proxy/index.ts` | Aspas no filtro ContractNumber |

