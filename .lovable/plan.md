

## Plano: Adicionar todos os campos ao MaxList

Atualmente o `MappedRecord` tem 15 campos. O formato esperado tem 28 campos. Precisa adicionar os 13 campos faltantes.

### Campos faltantes vs fonte de dados

| Campo | Disponível na API Installment? | Ação |
|-------|-------------------------------|------|
| EMAIL | Não (vem de model-details) | Placeholder vazio |
| ENDERECO | Não | Placeholder vazio |
| NUMERO | Não | Placeholder vazio |
| COMPLEMENTO | Não | Placeholder vazio |
| BAIRRO | Não | Placeholder vazio |
| CIDADE | Não | Placeholder vazio |
| ESTADO | Não | Placeholder vazio |
| CEP | Não | Placeholder vazio |
| DADOS_ADICIONAIS | Não | Placeholder vazio |
| COD_TITULO | Sim (pode derivar de TITULO) | Usar mesmo valor |
| NM_PARCELA | Sim (atualmente "PARCELA") | Renomear PARCELA → NM_PARCELA |
| ANO_VENCIMENTO | Pode derivar de DT_VENCIMENTO | Extrair ano |
| VL_SALDO | Não | Placeholder 0/null |
| VL_ATUALIZADO | Não | Placeholder 0/null |
| TP_TITULO | Não | Placeholder vazio |

### Alterações

**`src/pages/MaxListPage.tsx`**:
1. Expandir `MappedRecord` com os 13 campos novos (EMAIL, ENDERECO, NUMERO, COMPLEMENTO, BAIRRO, CIDADE, ESTADO, CEP, DADOS_ADICIONAIS, COD_TITULO, ANO_VENCIMENTO, VL_SALDO, VL_ATUALIZADO, TP_TITULO)
2. Renomear `PARCELA` → `NM_PARCELA` em toda a interface e mapeamento
3. Atualizar `mapItem()` para popular os novos campos (maioria vazio/null da API)
4. Atualizar `sourceHeaders` no `MaxListMappingDialog` com todos os 28 campos
5. Atualizar referências a `PARCELA` no código (tabela, export Excel, etc.)

**`src/components/maxlist/MaxListMappingDialog.tsx`**:
1. Atualizar o `autoMap` default para incluir os novos campos (EMAIL→email, ENDERECO→endereco, BAIRRO→bairro, CIDADE→cidade, ESTADO→uf, CEP→cep, NM_PARCELA→numero_parcela, VL_SALDO→valor_saldo, VL_ATUALIZADO→valor_atualizado)

**`src/services/fieldMappingService.ts`**:
1. Adicionar campo `bairro` nos SYSTEM_FIELDS (existe na tabela `clients` mas não está listado)
2. Adicionar `valor_saldo` nos SYSTEM_FIELDS (existe na tabela `clients`)

### Nota técnica
Os campos de endereço (EMAIL, ENDERECO, BAIRRO, CIDADE, ESTADO, CEP) virão vazios da API de Installments pois o MaxSystem não retorna esses dados nesse endpoint. Eles são preenchidos posteriormente no enriquecimento de endereço na formalização do acordo. Porém, ao estarem presentes como colunas, ficam disponíveis para mapeamento manual caso o usuário tenha esses dados de outra fonte.

