
## Buscar Endereco do MaxSystem para Importacao

### Problema
A Negociarie nao emite boleto sem endereco. Os dados de parcelas (Installments) do MaxSystem nao incluem endereco. E preciso buscar o endereco em dois passos:
1. Buscar o Id do modelo pelo ContractNumber via `/api/NewModelSearch`
2. Buscar os detalhes (endereco) via `/api/NewModelSearch/Details/{id}`

### Mudancas

**1. Migracao de banco: adicionar coluna `bairro` na tabela `clients`**

A tabela `clients` ja tem `endereco`, `cep`, `cidade` e `uf`, mas falta `bairro`. Adicionar:

```text
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS bairro text DEFAULT null;
```

**2. Edge Function `supabase/functions/maxsystem-proxy/index.ts`**

Adicionar duas novas actions:

- `action=model-search`: Recebe `contractNumber` como query param, chama `https://maxsystem.azurewebsites.net/api/NewModelSearch?$top=1&$filter=(ContractNumber+eq+{contractNumber})` e retorna o primeiro item (com o `Id`)

- `action=model-details`: Recebe `modelId` como query param, chama `https://maxsystem.azurewebsites.net/api/NewModelSearch/Details/{modelId}` e retorna os campos de endereco: `Address`, `CEP`, `Neighborhood`, `City`, `State`

**3. Frontend `src/pages/MaxListPage.tsx`**

Alterar o fluxo de importacao (`handleSendToCRM`):

- Antes de inserir cada batch no banco, agrupar os registros por `COD_CONTRATO` (numero do contrato)
- Para cada contrato unico, fazer duas chamadas ao proxy:
  1. `action=model-search&contractNumber={contrato}` para obter o `Id`
  2. `action=model-details&modelId={id}` para obter o endereco
- Cachear os enderecos por contrato para nao repetir chamadas
- Incluir os campos `endereco`, `cep`, `cidade`, `uf`, `bairro` no upsert para o banco

Mapeamento dos campos:
| MaxSystem | Clients |
|---|---|
| Address | endereco |
| CEP | cep |
| Neighborhood | bairro |
| City | cidade |
| State (numero) | uf (converter para sigla) |

- Adicionar tambem o `Email` retornado nos detalhes ao campo `email` do cliente (se disponivel)

**Mapa de State (numero para sigla UF):**
O MaxSystem retorna `State` como numero (ex: 26 = SP). Sera criado um mapa de conversao no edge function para retornar a sigla diretamente.

### Fluxo de importacao atualizado

```text
1. Usuario clica "Enviar para CRM"
2. Agrupar registros por COD_CONTRATO
3. Para cada contrato unico:
   a. GET proxy?action=model-search&contractNumber=202548
   b. Se encontrou Id: GET proxy?action=model-details&modelId=309486
   c. Cachear endereco para esse contrato
4. Montar rows com endereco preenchido
5. Upsert no banco (igual ao fluxo atual, mas com campos de endereco)
```

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Adicionar coluna `bairro` na tabela `clients` |
| `supabase/functions/maxsystem-proxy/index.ts` | Actions `model-search` e `model-details` |
| `src/pages/MaxListPage.tsx` | Buscar endereco por contrato antes de importar |
