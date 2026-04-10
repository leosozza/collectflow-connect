

# Adicionar filtro "Data Dev. Cheque" no MaxList

## O que será feito

Adicionar um novo filtro de data "Dev. Cheque" (devolução de cheque) na página MaxList, seguindo o mesmo padrão dos filtros existentes (Vencimento, Pagamento, Registro).

## Mudanças no arquivo `src/pages/MaxListPage.tsx`

### 1. Interface `MaxSystemItem` (~linha 96)
Adicionar campo `CheckReturnDateQuery: string | null` à interface.

### 2. Interface `MappedRecord` (~linha 117)
Adicionar campo `DT_DEVOLUCAO: string` e `MOTIVO_DEVOLUCAO: string | null`.

### 3. Estado de filtros (~linha 269)
Adicionar `devDe: ""` e `devAte: ""` ao estado inicial.

### 4. Função `mapItem` (~linha 168)
Mapear `CheckReturnDateQuery` → `DT_DEVOLUCAO` e `CheckReturnReason` → `MOTIVO_DEVOLUCAO`.

### 5. Função `buildFilter` (~linha 213)
- Adicionar `devolucao: "CheckReturnDateQuery"` ao `fieldMap`.
- Adicionar chamadas `addDateFilter(filters.devDe, "de", "devolucao")` e `addDateFilter(filters.devAte, "ate", "devolucao")`.
- Quando filtro de devolução estiver ativo, adicionar `Effected+eq+false` (conforme código de referência).

### 6. UI dos filtros (~linha 833)
Mudar o grid de `md:grid-cols-3` para `md:grid-cols-4` e adicionar bloco "Dev. Cheque" com campos De/Até usando `DatePickerField`, idêntico aos demais.

