

## Plano: Corrigir `model_name` não sendo salvo na importação MaxList

### Causa raiz

O campo `COD_CONTRATO` vem da API MaxSystem com espaços à esquerda (ex: `"    412564"`). Isso causa dois problemas:

1. **Na busca de ModelName**: O edge function envia o contrato com espaços para a API, que não retorna resultado
2. **Na correspondência do resultado**: Mesmo que retornasse, a chave `modelNames["412564"]` não bate com `m.COD_CONTRATO` (`"    412564"`)

Além disso, `MODEL_NAME` é inicializado como `""` (string vazia), e `"" || null` resulta em `null`.

### Correções em `src/pages/MaxListPage.tsx`

1. **Linha 125**: Trimmar o `ContractNumber` ao mapear `COD_CONTRATO`:
   - `COD_CONTRATO: item.ContractNumber` → `COD_CONTRATO: item.ContractNumber?.trim() || ""`

2. **Linha 472**: Trimmar `cod_contrato` no record de upsert:
   - `cod_contrato: item.COD_CONTRATO` → `cod_contrato: (item.COD_CONTRATO || "").trim()`

### Adição na seção colapsável (`ClientDetailHeader.tsx`)

Adicionar o campo "Nome do Modelo" na seção "Mais informações", na área de Identificação (ao lado de Cod. Devedor, Cod. Contrato, Credor, Parcelas).

### Arquivos
- `src/pages/MaxListPage.tsx` — trimmar `COD_CONTRATO`
- `src/components/client-detail/ClientDetailHeader.tsx` — adicionar `model_name` na seção colapsável

