

# Plano: Geração automática de boletos na Negociarie ao criar acordo

## Resumo

Após o acordo ser gravado com sucesso no banco, o sistema gerará automaticamente os boletos (uma cobrança por parcela) na API Negociarie e salvará os links retornados para consulta posterior.

## Mudanças

### 1. `src/services/agreementService.ts` — Adicionar chamada à Negociarie após `createAgreement`

Após o acordo ser criado com sucesso (e os títulos marcados como `em_acordo`), buscar os dados de endereço do cliente na tabela `clients` e chamar `negociarieService.novaCobranca()` para cada parcela simulada (entrada + parcelas regulares).

Lógica:
- Buscar um registro do cliente (`clients`) pelo CPF + credor para obter nome, email, telefone, CEP, endereço, bairro, cidade, UF
- Para cada parcela (entrada se houver + N parcelas mensais), chamar `negociarieService.novaCobranca()` com o payload flat que a API Negociarie espera (documento, nome, cep, endereco, bairro, cidade, uf, email, telefone, valor, vencimento, descricao)
- Salvar cada cobrança retornada via `negociarieService.saveCobranca()` com referência ao `agreement_id`
- Erros na geração de boletos NÃO devem impedir a criação do acordo — tratar com try/catch e logar o erro
- Exibir toast de sucesso/falha parcial no frontend

### 2. `src/components/client-detail/AgreementCalculator.tsx` — Feedback ao operador

Após `createAgreement` retornar com sucesso:
- Chamar uma nova função `generateAgreementBoletos()` passando o agreement criado + dados simulados (parcelas, datas, valores)
- Mostrar loading "Gerando boletos..." durante o processo
- Exibir toast com resultado: "X boletos gerados com sucesso" ou "Acordo criado, mas falha ao gerar boletos"

### 3. `src/services/negociarieService.ts` — Nova função `generateAgreementBoletos`

Função que recebe:
- `agreement` (id, cpf, credor, tenant_id)
- `installments` (array de { value, dueDate, number })
- Dados do devedor (nome, endereço, etc.)

Para cada parcela:
1. Chama `novaCobranca` com payload flat
2. Salva resultado em `negociarie_cobrancas` com `agreement_id` como referência
3. Retorna array de resultados (sucesso/falha por parcela)

### 4. Migração SQL — Adicionar coluna `agreement_id` na tabela `negociarie_cobrancas`

Adicionar `agreement_id UUID REFERENCES agreements(id)` para vincular cobranças geradas aos acordos.

## Fluxo do operador

1. Operador simula acordo no AgreementCalculator
2. Clica "GRAVAR ACORDO"
3. Sistema enriquece endereço (já existe)
4. Sistema cria o acordo no banco
5. **NOVO**: Sistema gera boletos na Negociarie automaticamente
6. Operador vê feedback: "Acordo gravado e X boletos gerados"

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | Nova função `generateAgreementBoletos` |
| `src/services/agreementService.ts` | Chamar geração de boletos após criar acordo |
| `src/components/client-detail/AgreementCalculator.tsx` | Feedback visual de geração de boletos |
| Migração SQL | Adicionar `agreement_id` em `negociarie_cobrancas` |

