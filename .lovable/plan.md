# Corrigir pedido indevido de CEP ao reemitir boleto

## Causa raiz (confirmada no banco)

Ao trocar a data de uma parcela e clicar em **Reemitir Boleto**, o sistema chama `getClientProfile()` em `src/services/clientProfileService.ts`. Essa função:

1. Lê `client_profiles` (perfil canônico).
2. **Se o registro existir, retorna direto** — mesmo com campos vazios (CEP, endereço, etc.).
3. Só faz fallback para a tabela `clients` (que tem o CEP correto) quando NÃO há linha em `client_profiles`.

Consulta no banco:

- 132.068 registros em `client_profiles`, dos quais **131.938 estão sem CEP**.
- 333 CPFs têm CEP correto em `clients` mas o perfil canônico está vazio.

Resultado: o `negociarieService` recebe `cep=""` e dispara `"Preencha o cadastro do devedor antes de gerar o boleto. Campo obrigatório ausente: cep"` — exatamente o aviso de "atualizar CEP" que o operador vê, mesmo com o CEP correto cadastrado no cliente.

O fluxo "Gerar TODOS os boletos" tem o mesmo defeito (usa o mesmo `getClientProfile`) e abre o dialog "Dados pendentes" pedindo CEP que já existe.

## Correção

### 1. `src/services/clientProfileService.ts` — fallback por campo (não por registro)

Mudar a lógica de "ou perfil ou fallback" para **mesclar perfil + clients sempre que houver campos faltando**:

- Carregar perfil canônico de `client_profiles`.
- Carregar linhas de `clients` (mesmo CPF / tenant).
- Para CADA campo (cep, endereco, bairro, cidade, uf, email, phone, nome_completo) que estiver vazio no perfil, preencher com o primeiro valor não vazio encontrado em `clients`.
- Se algum campo foi preenchido pelo fallback, disparar `upsertClientProfile` em background para autocorrigir o perfil canônico (sem bloquear a geração do boleto).

Isso resolve os 131.938 perfis incompletos de forma incremental e transparente — sem precisar de migração massiva.

### 2. Validação simétrica no UI "Gerar todos boletos"

`handleGenerateAllBoletos` em `AgreementInstallments.tsx` também usa `getClientProfile`, então passa a se beneficiar automaticamente da correção acima. Nada mais precisa mudar nesse fluxo.

### 3. (Opcional, não bloqueante) Backfill em background

Depois que a correção estiver no ar, executar uma rotina única de backfill que percorre os 333 CPFs com CEP em `clients` e atualiza `client_profiles`. Isto é apenas higiene de dados — a correção do fallback já elimina o problema do operador imediatamente, sem depender desse backfill.

## Arquivos editados

- `src/services/clientProfileService.ts` — nova lógica de merge perfil + clients por campo.

## Validação esperada

- Reemitir boleto após trocar data em cliente que tem CEP em `clients` mas perfil canônico vazio: gera boleto sem pedir CEP.
- "Gerar todos os boletos" no mesmo cenário: não abre mais o dialog "Dados pendentes" indevidamente.
- Após a primeira reemissão, o perfil canônico fica preenchido (auto-cura).
