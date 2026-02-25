# Integração MaxSystem

## 1. Visão Geral

O **MaxSystem** é o sistema legado de gestão de contratos e parcelas utilizado por alguns tenants. A integração permite consultar parcelas (pagas e em aberto), agências, e dados cadastrais (endereço, e-mail) dos devedores.

- **URL base da API**: `https://maxsystem.azurewebsites.net`
- **Proxy utilizado**: Edge Function `maxsystem-proxy` — todas as chamadas do frontend passam por este proxy para segurança e controle de acesso.

---

## 2. Autenticação e Controle de Acesso

### Fluxo de autenticação

1. O frontend envia o **JWT (Bearer token)** do usuário logado no header `Authorization`.
2. O proxy valida o token via `supabase.auth.getClaims()`.
3. Com o `user_id` extraído das claims, busca o `tenant_id` na tabela `tenant_users`.
4. Busca o `slug` do tenant na tabela `tenants`.
5. Verifica se o slug está na lista de tenants permitidos.

### Tenants permitidos

| Slug       | Descrição       |
|------------|-----------------|
| `maxfama`  | Tenant MaxFama  |
| `temis`    | Tenant Temis    |

Qualquer outro tenant recebe **403 — Acesso não autorizado**.

---

## 3. Endpoints Disponíveis

Todos os endpoints são acessados via query parameter `action` na mesma Edge Function:

```
GET /functions/v1/maxsystem-proxy?action={action}&{params}
```

### 3.1 Parcelas / Installments

**Action**: `installments` (ou omitido — é o default)

**API MaxSystem**: `GET /api/Installment`

#### Parâmetros

| Parâmetro | Descrição | Exemplo |
|-----------|-----------|---------|
| `filter`  | Filtro OData (obrigatório) | `PaymentDateQuery+ge+datetime'2024-01-01T00:00:00'` |
| `top`     | Limite de registros (default: 50000) | `50000` |

#### Filtros OData suportados

| Campo | Operador | Descrição |
|-------|----------|-----------|
| `PaymentDateQuery` | `ge`, `le` | Período de vencimento |
| `PaymentDateEffectedQuery` | `ge`, `le` | Período de pagamento efetivo |
| `RegisteredDateQuery` | `ge`, `le` | Período de registro |
| `ResponsibleCPF` | `eq` | CPF do devedor |
| `ContractNumber` | `eq` | Número do contrato |
| `IsCancelled` | `eq` | Status (`true` = cancelado, `false` = ativo) |
| `IdAgency` | `eq` | ID da agência (suporta múltiplas com `or`) |

#### Exemplo de filtro com múltiplas agências

```
(IdAgency+eq+1+or+IdAgency+eq+8)+and+PaymentDateQuery+ge+datetime'2024-01-01T00:00:00'
```

#### Campos retornados

| Campo MaxSystem | Tipo | Descrição |
|----------------|------|-----------|
| `ContractNumber` | string | Número do contrato |
| `IdRecord` | string | ID do registro |
| `ResponsibleName` | string | Nome do devedor |
| `ResponsibleCPF` | string | CPF do devedor |
| `Value` | number | Valor da parcela |
| `PaymentDateQuery` | string | Data de vencimento |
| `PaymentDateEffected` | string \| null | Data de pagamento (null = em aberto) |
| `IsCancelled` | boolean | Se a parcela foi cancelada |
| `Number` | number | Número da parcela |
| `CellPhone1` | string \| null | Celular 1 |
| `CellPhone2` | string \| null | Celular 2 |
| `HomePhone` | string \| null | Telefone fixo |

#### Diferenciação de parcelas

| Condição | Status |
|----------|--------|
| `PaymentDateEffected` preenchido | **Paga** |
| `IsCancelled === true` | **Cancelada** |
| Nenhum dos acima | **Em aberto (pendente)** |

#### Resposta

```json
{
  "Items": [...],
  "Count": 12345
}
```

---

### 3.2 Agências

**Action**: `agencies`

**API MaxSystem**: `GET /api/Agencies?$inlinecount=allpages`

Retorna a lista de agências disponíveis para filtro na importação.

#### Resposta

```json
{
  "Items": [
    { "Id": 1, "Name": "Agência Centro" },
    { "Id": 8, "Name": "Agência Norte" }
  ]
}
```

Usado como filtro **multi-select** na interface de importação (MaxList).

---

### 3.3 Busca de Modelo (Model Search)

**Action**: `model-search`

**API MaxSystem**: `GET /api/NewModelSearch?$top=1&$filter=(ContractNumber+eq+{contractNumber})`

Busca o ID interno do modelo associado a um número de contrato. Este ID é necessário para consultar os detalhes (endereço).

#### Parâmetros

| Parâmetro | Obrigatório | Descrição |
|-----------|-------------|-----------|
| `contractNumber` | Sim | Número do contrato |

#### Resposta

```json
{
  "item": {
    "Id": 12345,
    "ContractNumber": "ABC123",
    ...
  }
}
```

Se não encontrar, retorna `{ "item": null }`.

---

### 3.4 Detalhes do Modelo (Model Details)

**Action**: `model-details`

**API MaxSystem**: `GET /api/NewModelSearch/Details/{modelId}`

Retorna os dados cadastrais (endereço, e-mail) do devedor associado ao modelo.

#### Parâmetros

| Parâmetro | Obrigatório | Descrição |
|-----------|-------------|-----------|
| `modelId` | Sim | ID do modelo (obtido via `model-search`) |

#### Resposta

```json
{
  "Address": "Rua Exemplo, 123",
  "CEP": "01001000",
  "Neighborhood": "Centro",
  "City": "São Paulo",
  "State": "SP",
  "Email": "devedor@email.com",
  "ModelName": "Nome do Modelo"
}
```

> **Nota**: O campo `State` é convertido de número para sigla UF pelo proxy (ver seção 6).

---

## 4. Fluxo de Importação (MaxList)

### Página

`/maxlist` — acessível apenas para tenants `maxfama` e `temis`.

### Processo

1. **Filtrar**: O operador define filtros (vencimento, pagamento, registro, CPF, contrato, status, agências).
2. **Consultar**: O sistema busca parcelas via `action=installments`.
3. **Selecionar**: O operador pode selecionar registros individualmente ou importar todos.
4. **Status de Cobrança**: Antes de importar, o operador seleciona o "Status de Cobrança" de destino (ex: "Aguardando contato").
5. **Importar**: Os registros são enviados em lotes de 500 para a tabela `clients`.
6. **Log**: Um registro é salvo na tabela `import_logs` com totais de inseridos/ignorados.

### Upsert

A importação usa **upsert** pela chave `external_id` + `tenant_id`:

```
external_id = "{ContractNumber}-{Number}"
```

Exemplo: contrato `ABC123`, parcela `3` → `external_id = "ABC123-3"`.

### Mapeamento de Status

| Condição | Status no CRM |
|----------|--------------|
| `DT_PAGAMENTO` preenchido | `pago` |
| `STATUS === "CANCELADO"` | `quebrado` |
| Demais | `pendente` |

### Campos mapeados na importação

| Campo MaxSystem | Campo CRM (`clients`) | Observação |
|----------------|----------------------|------------|
| `ResponsibleName` | `nome_completo` | Trim aplicado |
| `ResponsibleCPF` | `cpf` | Apenas dígitos |
| — | `credor` | Fixo: `"YBRASIL"` |
| `Value` | `valor_parcela` | |
| `PaymentDateQuery` | `data_vencimento` | Convertido para ISO |
| `PaymentDateEffected` | `data_pagamento` | Convertido para ISO ou null |
| `{ContractNumber}-{Number}` | `external_id` | Chave de upsert |
| `ContractNumber` | `cod_contrato` | |
| `Number` | `numero_parcela` | |
| `Number` | `total_parcelas` | Mesmo valor (parcela individual) |
| — | `valor_entrada` | Fixo: `0` |
| `Value` (se pago) | `valor_pago` | Valor cheio se pago, 0 se pendente |
| — | `status` | Derivado (ver tabela acima) |
| `CellPhone1` | `phone` | Apenas dígitos |
| `CellPhone2` | `phone2` | Apenas dígitos |
| `HomePhone` | `phone3` | Apenas dígitos |

### Log de importação

Salvo na tabela `import_logs`:

| Campo | Valor |
|-------|-------|
| `source` | `"maxlist"` |
| `total_records` | Total de registros processados |
| `inserted` | Quantidade inserida/atualizada |
| `skipped` | Quantidade com erro |
| `credor` | `"YBRASIL"` |

---

## 5. Enriquecimento de Endereço

### Momento da execução

O enriquecimento de endereço **não ocorre na importação**. Ele é executado no momento da **formalização do acordo**, garantindo dados atualizados.

### Serviço

`src/services/addressEnrichmentService.ts` — função `enrichClientAddress(cpf, tenantId, onProgress?)`

### Processo

```
1. Busca todos os registros de `clients` com o CPF informado
2. Se algum já tem endereço preenchido → retorna o existente (sem consultar API)
3. Coleta os `cod_contrato` únicos desses registros
4. Para cada contrato (em lotes de 5 em paralelo):
   a. Chama `model-search` com o ContractNumber → obtém modelId
   b. Chama `model-details` com o modelId → obtém endereço
   c. Salva no cache local (Map) para evitar chamadas duplicadas
5. Seleciona o primeiro endereço válido encontrado
6. Atualiza TODOS os registros do CPF com o endereço
```

### Campos persistidos

| Campo API | Campo `clients` |
|-----------|-----------------|
| `Address` | `endereco` |
| `CEP` | `cep` |
| `Neighborhood` | `bairro` |
| `City` | `cidade` |
| `State` (UF) | `uf` |
| `Email` | `email` |
| `ModelName` | `observacoes` (prefixo "Modelo: ") |

### Cache

Um `Map<string, AddressData>` é mantido durante a execução para evitar chamadas duplicadas ao MaxSystem quando múltiplos registros compartilham o mesmo contrato.

---

## 6. Mapa de Conversão de Estados

O MaxSystem retorna o estado como um **número inteiro**. O proxy converte para a sigla UF correspondente.

| Número | UF | Número | UF | Número | UF |
|--------|-----|--------|-----|--------|-----|
| 1 | AC | 10 | MA | 19 | RJ |
| 2 | AL | 11 | MT | 20 | RN |
| 3 | AP | 12 | MS | 21 | RS |
| 4 | AM | 13 | MG | 22 | RO |
| 5 | BA | 14 | PA | 23 | RR |
| 6 | CE | 15 | PB | 24 | SC |
| 7 | DF | 16 | PR | 25 | SE* |
| 8 | ES | 17 | PE | 26 | SP* |
| 9 | GO | 18 | PI | 27 | TO |

> **⚠️ Inconsistência conhecida**: No proxy (`maxsystem-proxy/index.ts`), o mapeamento é `25=SE, 26=SP`. No frontend (`addressEnrichmentService.ts`), é `25=SP, 26=SE`. O proxy faz a conversão antes de retornar, então o frontend recebe a string UF já convertida. Recomenda-se padronizar ambos os arquivos.

---

## 7. Estrutura de Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `supabase/functions/maxsystem-proxy/index.ts` | Edge Function proxy — autenticação, controle de acesso, roteamento para APIs MaxSystem |
| `src/pages/MaxListPage.tsx` | Interface de consulta e importação de parcelas |
| `src/services/addressEnrichmentService.ts` | Enriquecimento de endereço na formalização do acordo |

---

## 8. Tabela Resumo: Mapeamento de Campos

### MaxSystem → CRM (Importação)

| MaxSystem | CRM | Tipo |
|-----------|-----|------|
| `ContractNumber` | `cod_contrato` | string |
| `ResponsibleName` | `nome_completo` | string |
| `ResponsibleCPF` | `cpf` | string (só dígitos) |
| `Value` | `valor_parcela` | number |
| `PaymentDateQuery` | `data_vencimento` | date |
| `PaymentDateEffected` | `data_pagamento` | date \| null |
| `Number` | `numero_parcela` | number |
| `CellPhone1` | `phone` | string |
| `CellPhone2` | `phone2` | string |
| `HomePhone` | `phone3` | string |
| `IsCancelled` | `status` | derivado |
| `{Contract}-{Number}` | `external_id` | string (chave upsert) |

### MaxSystem → CRM (Enriquecimento de Endereço)

| MaxSystem | CRM | Tipo |
|-----------|-----|------|
| `Address` | `endereco` | string |
| `CEP` | `cep` | string |
| `Neighborhood` | `bairro` | string |
| `City` | `cidade` | string |
| `State` | `uf` | string (sigla) |
| `Email` | `email` | string |
| `ModelName` | `observacoes` | string |
