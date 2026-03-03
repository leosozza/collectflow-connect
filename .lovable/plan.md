

## Problema

O mapeamento salvo no banco de dados usa chaves no estilo **planilha** (`NOME_DEVEDOR`, `CNPJ_CPF`, `FONE_1`...), mas a função `buildRecordFromMapping` tenta ler essas chaves diretamente do item cru da API, onde os campos reais são `ResponsibleName`, `ResponsibleCPF`, `CellPhone1`, etc. Resultado: todos os valores vêm como `null` → CPF e Nome ausentes → 537 rejeitados.

## Solução

Duas correções necessárias:

### 1. Atualizar o mapeamento salvo no banco de dados
O registro existente (`id: 04807170-...`) precisa ser atualizado para usar as chaves corretas da API. Isso será feito automaticamente ao abrir as Configurações e salvar novamente, mas para resolver imediatamente, o código deve detectar e migrar mapeamentos antigos.

### 2. `src/pages/MaxListPage.tsx` — Adicionar fallback de migração
Na função `handleSendToCRM`, ao carregar o mapeamento salvo, verificar se as chaves são do formato antigo (planilha) e, se forem, converter automaticamente para o formato API antes de usar:

```text
Mapa de conversão (chave antiga → chave nova):
NOME_DEVEDOR    → ResponsibleName
CNPJ_CPF        → ResponsibleCPF  
COD_CONTRATO    → ContractNumber
COD_DEVEDOR     → IdRecord
FONE_1          → CellPhone1
FONE_2          → CellPhone2
FONE_3          → HomePhone
EMAIL           → Email
NM_PARCELA      → Number
VL_TITULO       → Value
VL_SALDO        → NetValue
DT_VENCIMENTO   → PaymentDateQuery
DT_PAGAMENTO    → PaymentDateEffected
STATUS          → IsCancelled
NOME_MODELO     → ModelName
OBSERVACOES     → Observations
COD_TITULO      → Id
DADOS_ADICIONAIS → Producer
```

A função criará um novo objeto de mapping convertendo as chaves antigas para as novas, mantendo os valores (campos do sistema) iguais. Se detectar que as chaves já são no formato API, usa direto sem conversão.

### Arquivos a editar

| Arquivo | Alteração |
|---|---|
| `src/pages/MaxListPage.tsx` | Adicionar mapa de migração `LEGACY_TO_API_KEYS` e função `migrateLegacyMapping()` no fluxo `handleSendToCRM` |

