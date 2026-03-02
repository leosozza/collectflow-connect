

## Plano: Adicionar campos de destino correspondentes aos campos de origem

Comparando os 29 campos de origem do MaxList com os SYSTEM_FIELDS atuais, faltam 8 campos de destino:

| Campo Origem | Campo Destino (a criar) |
|---|---|
| TITULO | `titulo` |
| NUMERO | `numero` (nº do endereço) |
| COMPLEMENTO | `complemento` |
| DADOS_ADICIONAIS | `dados_adicionais` |
| COD_TITULO | `cod_titulo` |
| ANO_VENCIMENTO | `ano_vencimento` |
| TP_TITULO | `tp_titulo` |
| MODEL_NAME | `model_name` |

Os demais já existem com nomes diferentes (ex: NOME_DEVEDOR → `nome_completo`, CNPJ_CPF → `cpf`, FONE_1 → `phone`, VL_TITULO → `valor_parcela`, ESTADO → `uf`, COD_CONTRATO → `cod_contrato`, COD_DEVEDOR → `external_id`).

### Alterações

**`src/services/fieldMappingService.ts`**:
- Adicionar os 8 campos faltantes ao array `SYSTEM_FIELDS` (antes do `__ignorar__`)

**`src/components/maxlist/MaxListMappingDialog.tsx`**:
- Atualizar o `autoMap` para mapear os novos campos (TITULO→titulo, NUMERO→numero, COMPLEMENTO→complemento, DADOS_ADICIONAIS→dados_adicionais, COD_TITULO→cod_titulo, ANO_VENCIMENTO→ano_vencimento, TP_TITULO→tp_titulo, MODEL_NAME→model_name)

