

## Plano: Corrigir mapeamento ModelName e chaves legadas faltantes

### Problema
O mapeamento salvo no banco (`id: 04807170-...`) ainda usa chaves de planilha e contém inconsistências:

1. **`NOME_MODELO`** aponta para `custom:nome_do_modelo` em vez de `model_name` (coluna real na tabela `clients`)
2. **`MODEL_NAME`** aponta para `model_name` mas não existe no `LEGACY_TO_API_KEYS`, então fica como chave desconhecida após migração
3. Várias chaves legadas (`CREDOR`, `TITULO`, `ANO_VENCIMENTO`, `NUMERO`, `COMPLEMENTO`, `ESTADO`, `TP_TITULO`, `VL_ATUALIZADO`) não têm correspondência no mapa de migração

### Solução

#### 1. `src/pages/MaxListPage.tsx` — Expandir `LEGACY_TO_API_KEYS`
Adicionar as chaves faltantes:
```
CREDOR       → (ignorar — valor fixo "YBRASIL")
TITULO       → (mapeado para external_id/titulo)
ANO_VENCIMENTO → (campo custom ou ignorar)
NUMERO       → (campo numero)
COMPLEMENTO  → (campo complemento)
ESTADO       → (campo UF — mas API não retorna diretamente)
TP_TITULO    → (campo tp_titulo)
VL_ATUALIZADO → (campo valor_atualizado)
MODEL_NAME   → "ModelName"
```

#### 2. `src/pages/MaxListPage.tsx` — Garantir que `ModelName` mapeie para `model_name`
No `buildRecordFromMapping`, o campo `ModelName` da API já é lido corretamente via `getRawValue`. O problema é que o mapeamento salvo aponta para `custom:nome_do_modelo`. A correção é:
- Adicionar um fallback no `buildRecordFromMapping`: se `model_name` não foi preenchido pelo mapeamento, tentar ler `rawItem.ModelName` diretamente
- Isso garante que mesmo com mapeamento incorreto, o `model_name` é sempre populado

#### 3. Atualizar o mapeamento salvo no banco
Na migração de chaves legadas, além de converter as chaves, corrigir o target de `NOME_MODELO`/`ModelName` para `model_name` em vez de `custom:nome_do_modelo`.

### Arquivos a editar

| Arquivo | Alteração |
|---|---|
| `src/pages/MaxListPage.tsx` | Expandir `LEGACY_TO_API_KEYS`, adicionar fallback de `model_name` no `buildRecordFromMapping`, corrigir target na migração |

