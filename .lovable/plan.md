

## Plano: Corrigir SOURCE_HEADERS do Settings para usar nomes reais do payload da API

### Problema
O `MaxListSettingsDialog` e o `MaxListMappingDialog` usam nomes de campos estilo planilha (ex: `NOME_DEVEDOR`, `CNPJ_CPF`, `FONE_1`) como campos de origem. Porém, o payload real da API do MaxSystem usa nomes diferentes (ex: `ResponsibleName`, `ResponsibleCPF`, `CellPhone1`). O mapeamento deve ser feito dos **nomes reais da API** para os campos do sistema.

### Mapeamento correto (API → Sistema)

| Campo API (payload)       | Campo Sistema (destino)    |
|---------------------------|----------------------------|
| ResponsibleName           | nome_completo              |
| ResponsibleCPF            | cpf                        |
| ContractNumber            | cod_contrato               |
| IdRecord                  | external_id                |
| CellPhone1                | phone                      |
| CellPhone2                | phone2                     |
| HomePhone                 | phone3                     |
| Email                     | email                      |
| Number                    | numero_parcela             |
| Value                     | valor_parcela              |
| NetValue                  | valor_saldo                |
| Discount                  | (novo campo ou ignorar)    |
| PaymentDateQuery          | data_vencimento            |
| PaymentDateEffected       | data_pagamento             |
| IsCancelled               | status                     |
| ModelName                 | custom:nome_do_modelo      |
| Observations              | observacoes                |
| Id                        | cod_titulo                 |
| Producer                  | (novo ou dados_adicionais) |

### Alterações

**1. `src/components/maxlist/MaxListSettingsDialog.tsx`**
- Substituir `SOURCE_HEADERS` pelos nomes reais dos campos do payload da API
- Atualizar `DEFAULT_AUTO_MAP` para mapear dos nomes da API para os campos do sistema

**2. `src/pages/MaxListPage.tsx`**
- Atualizar `mapItem()` para, quando houver mapeamento salvo, aplicar o mapeamento diretamente dos campos da API (sem a conversão intermediária para nomes de planilha)
- Atualizar o fluxo `handleSendToCRM` para usar os nomes de campo da API como chaves do `sourceHeaders`

**3. `src/components/maxlist/MaxListMappingDialog.tsx`**
- Atualizar o `autoMap` default para usar nomes da API como chaves

### Arquivos a editar

| Arquivo | O que muda |
|---|---|
| `src/components/maxlist/MaxListSettingsDialog.tsx` | SOURCE_HEADERS e DEFAULT_AUTO_MAP usam nomes da API |
| `src/pages/MaxListPage.tsx` | mapItem aplica mapeamento salvo diretamente dos campos API |
| `src/components/maxlist/MaxListMappingDialog.tsx` | autoMap usa nomes da API |

