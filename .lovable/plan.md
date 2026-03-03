

## Plano: Adotar planilha modelo e relaxar campos obrigatórios

### Contexto
A planilha modelo (`PLANILHA_MODELO.xlsx`) tem 31 colunas:
`CREDOR, COD_CONTRATO, NOME_DEVEDOR, CNPJ_CPF, FONE_1, FONE_2, FONE_3, EMAIL, ENDERECO, NUMERO, COMPLEMENTO, BAIRRO, CIDADE, ESTADO, CEP, TITULO, TP_TITULO, NM., PARCELA, DT_PAGAMENTO, DT_VENCIMENTO, ANO_VENCIMENTO, VL_TITULO, VL_SALDO, VL_ATUALIZADO, STATUS, ADICIONAL 1-4`

O usuário definiu que apenas **CREDOR**, **NOME_DEVEDOR** e **CNPJ_CPF** são obrigatórios para importação. Os demais campos são opcionais.

### Problema atual
- `SYSTEM_FIELDS` marca `nome_completo`, `cpf` e `data_vencimento` como required
- `validations.ts` exige `numero_parcela`, `valor_parcela`, `valor_pago`, `data_vencimento` e `status` como obrigatórios
- `importService.ts` rejeita linhas sem `data_vencimento` (skip na linha 245)
- O mapeamento automático não reconhece as colunas `NM.`, `ADICIONAL 1-4`, `TITULO` e `TP_TITULO`

### Alterações

#### 1. `src/services/fieldMappingService.ts` — Atualizar campos obrigatórios
- Marcar como `required: true` apenas: `credor`, `nome_completo`, `cpf`
- `data_vencimento` passa a `required: false`

#### 2. `src/lib/validations.ts` — Relaxar schema de importação
- `numero_parcela` → opcional com default 1
- `valor_parcela` → opcional com default 0
- `valor_pago` → opcional com default 0
- `data_vencimento` → opcional (aceitar vazio)
- `status` → opcional com default "pendente"

#### 3. `src/services/importService.ts` — Aceitar linhas sem data de vencimento
- Remover o `if (!dataVencimento) continue;` (linha 246) — permitir linhas sem data
- Quando `data_vencimento` estiver vazia, usar valor default (data atual ou null)
- Adicionar mapeamentos para as novas colunas da planilha modelo:
  - `NM.` → `numero_parcela` (é o campo "NM." da planilha, não "PARCELA")
  - `TITULO` → `titulo`
  - `TP_TITULO` → `tp_titulo`
  - `ANO_VENCIMENTO` → `ano_vencimento`
  - `VL_SALDO` → `valor_saldo`
  - `ADICIONAL 1` → `custom:adicional_1` (ou `dados_adicionais`)
  - `ADICIONAL 2`, `ADICIONAL 3`, `ADICIONAL 4` → campos custom ou observações
  - `NUMERO` → `numero`
  - `COMPLEMENTO` → `complemento`
  - `BAIRRO` → `bairro`

#### 4. `src/components/clients/ImportDialog.tsx` — Expandir builtinMap
Adicionar as novas colunas ao mapeamento automático:
- `NM.` → `numero_parcela`
- `TITULO` → `titulo`
- `TP_TITULO` → `tp_titulo`
- `ANO_VENCIMENTO` → `ano_vencimento`
- `VL_SALDO` → `valor_saldo`
- `NUMERO` → `numero`
- `COMPLEMENTO` → `complemento`
- `BAIRRO` → `bairro`
- `ADICIONAL 1..4` → campos `dados_adicionais` ou custom

#### 5. Salvar a planilha modelo no projeto
Copiar `PLANILHA_MODELO.xlsx` para `public/templates/PLANILHA_MODELO.xlsx` para que o admin possa baixá-la como referência futura.

### Arquivos a editar

| Arquivo | Alteração |
|---|---|
| `src/services/fieldMappingService.ts` | `credor` required=true, `data_vencimento` required=false |
| `src/lib/validations.ts` | Relaxar campos obrigatórios no schema |
| `src/services/importService.ts` | Aceitar linhas sem data, adicionar mapeamentos novos |
| `src/components/clients/ImportDialog.tsx` | Expandir builtinMap com colunas da planilha modelo |
| `public/templates/PLANILHA_MODELO.xlsx` | Copiar planilha modelo |

