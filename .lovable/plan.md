

## Plano: Capturar ModelName (e outros campos) diretamente do Installments API

### Problema
O endpoint `Installment` do MaxSystem **já retorna `ModelName`** no payload, mas:
1. A interface `MaxSystemItem` (linha 56) não declara `ModelName`
2. A função `mapItem()` (linha 119) não mapeia esse campo
3. Outros campos úteis também são ignorados: `Email`, `Observations`, `NetValue`, `Discount`, `Producer`, `Origin`

### Solução
Adicionar `ModelName` (e opcionalmente outros campos relevantes) ao fluxo de dados do MaxList.

### Alterações em `src/pages/MaxListPage.tsx`

**1. Atualizar `MaxSystemItem`** (linhas 56-70):
- Adicionar `ModelName: string | null`
- Adicionar `Email: string | null`
- Adicionar `Observations: string | null`
- Adicionar `NetValue: number`
- Adicionar `Discount: number`

**2. Atualizar `MappedRecord`** (linhas 72-101):
- Adicionar `NOME_MODELO: string | null`
- Adicionar `OBSERVACOES: string | null`
- Adicionar `VL_SALDO` usar `NetValue`
- `EMAIL` usar `Email` da API

**3. Atualizar `mapItem()`** (linhas 119-151):
- Mapear `NOME_MODELO: item.ModelName || null`
- Mapear `EMAIL: item.Email || null`
- Mapear `OBSERVACOES: item.Observations || null`
- Mapear `VL_SALDO: item.NetValue || null`

Isso elimina a necessidade de fazer chamadas extras para obter o `ModelName` — ele já vem na listagem.

### Arquivos a editar

| Arquivo | Alteração |
|---|---|
| `src/pages/MaxListPage.tsx` | Adicionar campos à interface, mapeamento e exibição |

