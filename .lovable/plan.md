## Problema confirmado

Para o CPF `035.682.136-64` (Alexandre Vitor Ponciano):
- `client_profiles` tem o registro com `cep`, `endereco`, `cidade`, `uf` todos `NULL`.
- `clients` tem todos os dados completos: `cep=08.744-106`, `endereco=Rua Carmelino Jordano, 370`, `cidade=Mogi das Cruzes`, `uf=SP`.

O fix anterior em `clientProfileService.ts` cobre esse caso, mas o operador continuou recebendo o erro — provavelmente serviu a versão antiga em cache do navegador (problema agora resolvido pelo novo `UpdateButton`).

## Solução em duas frentes

### 1. Defesa em profundidade no `negociarieService.ts`

Adicionar uma função `enrichClientDataFromClients()` chamada logo após `getClientProfile()` em `generateSingleBoleto` e `generateAgreementBoletos`. Se algum campo obrigatório (cep, endereco, bairro, cidade, uf, email, phone, nome_completo) ainda estiver vazio, busca direto em `clients` por CPF (limpo e formatado) e preenche. Faz upsert em background no `client_profiles` para auto-cura.

Isso garante que o boleto nunca falha por campo vazio quando o dado existe em `clients`, independentemente do estado do cache, do `client_profiles` ou de versões antigas em produção.

### 2. Backfill em massa do `client_profiles`

Migration única que percorre `client_profiles` com campos vazios e preenche cada um com o primeiro valor não-vazio encontrado em `clients` para o mesmo `tenant_id` + `cpf`. Resolve os 130k+ registros incompletos de uma vez, sem esperar o acesso individual de cada cliente.

A migration:
- Atualiza apenas campos que estão vazios no profile (não sobrescreve dados existentes).
- Cobre: `cep`, `endereco`, `bairro`, `cidade`, `uf`, `email`, `phone`, `phone2`, `phone3`, `nome_completo`.
- Marca `source = 'backfill_from_clients'` quando o registro foi preenchido por essa rotina.

## Arquivos alterados

- `src/services/negociarieService.ts` — nova função `enrichClientDataFromClients()` + chamadas em `generateSingleBoleto` e `generateAgreementBoletos`.
- Migration SQL — backfill único de `client_profiles`.

## Resultado esperado

- Boletos param de falhar com "Campo obrigatório ausente: cep" sempre que o dado existe na tabela `clients` (mesmo para clientes ainda não acessados).
- Geração de boleto torna-se à prova de cache antigo: mesmo se um operador estiver com a versão antiga, a próxima publicação corrige.
