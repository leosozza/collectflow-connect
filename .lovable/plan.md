
## Corrigir os 2 erros de endereço no perfil do cliente

### Diagnóstico confirmado

Há 3 problemas diferentes no fluxo atual, e eles se somam:

1. **Busca no MaxSystem durante a formalização está quebrando em dois pontos**
   - `AgreementCalculator.tsx` dispara `enrichClientAddress(cpf, tenantId)` em background e **não espera o retorno** antes de chamar a geração automática de boletos.
   - `addressEnrichmentService.ts` procura `clients` com `.eq("cpf", cpf)`, mas a ficha do cliente usa CPF ora limpo, ora formatado em vários pontos. Isso pode fazer o enriquecimento **não encontrar nenhuma linha**.
   - Quando encontra endereço, o serviço atualiza **só a tabela `clients`**, mas a formalização e a geração de boletos usam **`client_profiles` como fonte canônica**.

2. **A geração de boletos lê uma fonte diferente da que o enriquecimento atualiza**
   - `generate-agreement-boletos` lê primeiro `client_profiles`.
   - Se faltar dado, faz fallback para **apenas 1 linha** de `clients` com `.limit(1)`, sem consolidação. Em CPF com várias parcelas, pode pegar uma linha vazia e ignorar outra que já tem endereço.
   - O Edge ainda valida campos obrigatórios sem `bairro`, ficando inconsistente com o restante do fluxo.

3. **Editar CEP/endereço no perfil não reflete corretamente na própria tela**
   - `ClientDetailHeader.tsx` salva em banco via `updateSingleField` e `updateClientMutation`, mas invalida a query `["clients"]`.
   - A página do perfil usa a query `["client-detail", cpf, credorFilter]`.
   - Resultado: o CEP pode até salvar/preencher no banco, mas a ficha **não refaz o fetch correto**, parecendo que “não funcionou”.

### O caminho atual da atualização de endereço

#### Formalização do acordo
```text
Perfil do cliente
→ AgreementCalculator.handleSubmit()
→ enrichClientAddress(cpf, tenantId)
→ UPDATE em clients
→ createAgreement(...)
→ supabase.functions.invoke("generate-agreement-boletos")
→ Edge lê client_profiles
→ fallback imperfeito em clients
```

#### Edição manual no perfil
```text
Perfil do cliente
→ ClientDetailHeader.updateSingleField() ou updateClientMutation()
→ UPDATE em clients
→ upsertClientProfile(...)
→ invalidação errada da query
→ tela não reflete imediatamente
```

### Correções propostas

### 1) `src/services/addressEnrichmentService.ts`
Corrigir o enriquecimento para gravar no lugar certo e localizar o CPF corretamente.

**Mudanças:**
- Normalizar o CPF (`raw` e formatado) na busca por `clients`, igual ao restante da aplicação.
- Quando já houver endereço em `clients`, sincronizar também `client_profiles` antes de retornar.
- Quando o MaxSystem retornar endereço, atualizar:
  - todas as linhas de `clients` daquele CPF/tenant
  - a tabela `client_profiles` via `upsertClientProfile(...)`
- Manter `email` sincronizado também, já que ele entra na validação de boleto.

**Objetivo:** a formalização e a geração de boleto passarem a enxergar o mesmo dado.

---

### 2) `src/components/client-detail/AgreementCalculator.tsx`
Parar de depender de enriquecimento “em background” quando o objetivo é gerar boleto na sequência.

**Mudanças:**
- Antes da geração automática de boletos, verificar os campos obrigatórios canônicos.
- Se faltar endereço/CEP/cidade/UF/bairro, rodar `await enrichClientAddress(...)` com status visual.
- Depois do enriquecimento, reexecutar `checkRequiredFields()`.
- Só então:
  - gerar os boletos automaticamente, ou
  - abrir o fluxo de campos faltantes se ainda estiver incompleto.
- Remover a premissa atual de que “o endereço chega depois” para o caso de formalização com boleto imediato.

**Objetivo:** quando o cliente não tiver endereço, o sistema tentar buscar no MaxSystem **antes** de concluir que faltam dados para boleto.

---

### 3) `supabase/functions/generate-agreement-boletos/index.ts`
Endurecer a geração automática para usar a mesma lógica canônica da aplicação.

**Mudanças:**
- Se `client_profiles` estiver incompleto, fazer fallback consolidando **todas as linhas de `clients` do CPF**, e não uma só.
- Incluir `bairro` na lista de campos obrigatórios para ficar consistente com:
  - `AgreementCalculator`
  - geração manual de cobrança
  - payload enviado à Negociarie
- Se o fallback encontrar dados válidos, opcionalmente já devolver a geração normal; se não, marcar `boleto_pendente` com motivo consistente.

**Objetivo:** eliminar os casos em que existe endereço no banco, mas o Edge pega a linha errada e falha.

---

### 4) `src/components/client-detail/ClientDetailHeader.tsx`
Corrigir o refresh da ficha após edição inline ou pelo painel “Editar”.

**Mudanças:**
- Trocar a invalidação de `["clients"]` por invalidação/refetch da query correta do perfil:
  - `["client-detail"]` como prefixo, ou
  - callback de `ClientDetailPage` para `refetch()`
- Aplicar isso tanto em:
  - `updateSingleField`
  - `updateClientMutation`
- Manter a sincronização em `client_profiles`, que já existe e está correta.

**Objetivo:** quando o usuário informar o CEP no perfil, os campos de endereço aparecerem atualizados na própria ficha sem precisar recarregar a página.

---

### 5) Ajuste fino no comportamento do CEP inline
Consolidar o comportamento do CEP na edição direta do perfil.

**Mudanças:**
- Garantir que o fluxo inline continue preenchendo `endereco`, `bairro`, `cidade` e `uf`.
- Resetar o controle interno do último lookup quando sair da edição, para evitar casos em que o mesmo CEP não dispara novamente.
- Validar que o preenchimento automático funcione tanto:
  - no campo inline da ficha
  - no painel “Editar Dados do Devedor”

**Objetivo:** evitar regressão após a troca do modal pela edição direta.

### Validação esperada

1. **Formalizar acordo sem endereço**
   - Cliente sem endereço na ficha.
   - Ao formalizar, o sistema busca no MaxSystem.
   - Endereço é salvo em `clients` e `client_profiles`.
   - A geração automática do boleto usa os dados encontrados.

2. **Formalizar acordo quando o CPF estiver salvo com máscara**
   - Mesmo assim o enriquecimento encontra os registros e atualiza corretamente.

3. **Editar CEP no perfil do cliente**
   - Ao digitar um CEP válido, rua/bairro/cidade/UF são preenchidos.
   - Ao salvar, a ficha reflete os dados sem refresh manual.

4. **Gerar boleto depois de correção manual**
   - Ajustando endereço no perfil, o acordo deixa de ficar preso por leitura inconsistente entre `clients` e `client_profiles`.

### Arquivos a alterar
- `src/services/addressEnrichmentService.ts`
- `src/components/client-detail/AgreementCalculator.tsx`
- `src/components/client-detail/ClientDetailHeader.tsx`
- `supabase/functions/generate-agreement-boletos/index.ts`

### Detalhes técnicos
- Fonte canônica correta: `client_profiles`
- `clients` continua sendo sincronizada por retrocompatibilidade
- CPF deve ser tratado sempre em formato limpo + formatado nas buscas legadas
- O fallback do Edge não deve usar `.limit(1)` para dados cadastrais compartilhados por CPF
