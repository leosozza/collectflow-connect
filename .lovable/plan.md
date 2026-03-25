

# Plano: Corrigir geração de boleto e formulário de edição de endereço

## Problema raiz

1. **Boleto falha mesmo após editar endereço**: O `generateSingleBoleto` busca dados do cliente com `.eq("cpf", cpf).eq("credor", credor)` — se o credor no acordo não bater exatamente com o campo `credor` na tabela `clients`, a query retorna vazio. Com dados vazios, os fallbacks ("00000000", "Não informado") são rejeitados pela API Negociarie.

2. **Formulário de edição**: CEP está no final do formulário e não faz busca automática via ViaCEP (como já existe no cadastro de novo cliente).

## Correções

### 1. Tornar a busca de dados do cliente mais resiliente (`negociarieService.ts`)

- Remover o filtro `.eq("credor", agreement.credor)` da query de busca de endereço — usar apenas `.eq("cpf", cpf)` com `.limit(1)`, já que o endereço é do devedor, não do credor
- Se a primeira tentativa retornar vazio, tentar também com CPF formatado (caso o banco armazene com pontuação)
- Lançar erro claro se nenhum dado de endereço for encontrado e os campos obrigatórios estiverem vazios, em vez de enviar placeholders que a API rejeita
- Aplicar a mesma correção em `generateAgreementBoletos`

### 2. Reorganizar formulário de edição + busca por CEP (`ClientDetailHeader.tsx`)

- Mover o campo CEP para o **primeiro** campo da seção de endereço
- Adicionar `onBlur` no campo CEP que chama a API ViaCEP (`https://viacep.com.br/ws/{cep}/json/`) e preenche automaticamente endereço, bairro, cidade e UF — idêntico ao que já existe em `ClientForm.tsx`
- Adicionar indicador visual de loading enquanto busca o CEP

### 3. Validação pré-envio de boleto

- Antes de chamar `novaCobranca`, verificar se os campos obrigatórios (documento, nome, cep, endereco, cidade, uf) possuem valores reais
- Se não, exibir toast informativo: "Preencha o endereço do devedor antes de gerar o boleto"

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | Remover filtro por credor na busca de endereço; validar campos antes de chamar API |
| `src/components/client-detail/ClientDetailHeader.tsx` | Mover CEP para primeiro; adicionar busca ViaCEP no onBlur |

