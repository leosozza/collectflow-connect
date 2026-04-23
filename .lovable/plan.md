
## Plano: corrigir o fluxo de “dados faltantes” ao formalizar acordo

### Objetivo
Fazer com que, ao abrir o modal de dados faltantes (ex.: e-mail ausente), o operador possa preencher o campo e clicar em **“Salvar e Gerar Boletos”**, e o sistema:
1. salve os dados cadastrais,
2. crie o acordo pelo fluxo canônico,
3. dispare a geração de boletos pelo path novo,
4. sem obrigar o operador a sair da tela.

### Arquivo afetado
- `src/components/client-detail/AgreementCalculator.tsx`

### Correção proposta

#### 1) Remover a dependência incorreta de `pendingAgreement`
Hoje o modal abre no pre-flight antes do acordo existir, então `pendingAgreement` fica `null` e o botão parece morto.

Ajuste:
- remover o uso de `pendingAgreement` como pré-requisito em `handleSaveMissingFields`
- eliminar o estado `pendingAgreement` se ele não for mais necessário
- eliminar também o helper legado `generateBoletosForAgreement`, já que ele usa o path antigo

Resultado:
- o modal deixa de depender de um acordo “já criado”, porque de fato ele ainda não existe nesse ponto do fluxo

#### 2) Fazer `handleSaveMissingFields` salvar cadastro e reexecutar o fluxo oficial
Refatorar `handleSaveMissingFields` para:

1. validar se todos os campos faltantes foram preenchidos
2. persistir os dados em:
   - `clients` (retrocompatibilidade)
   - `client_profiles` via `upsertClientProfile` (fonte canônica)
3. fechar o modal
4. reexecutar o mesmo fluxo de formalização usado por `handleConfirmedSubmit`

Implementação sugerida:
- extrair a criação do acordo para uma função central, por exemplo:
  - `submitAgreement(options?: { skipMissingCheck?: boolean; markBoletoPendente?: boolean })`
- `handleConfirmedSubmit` passa a chamar essa função
- `handleSaveMissingFields` salva os dados e depois chama:
  - `submitAgreement({ skipMissingCheck: false })`

Assim, após preencher o e-mail, o sistema volta ao fluxo normal:
- revalida os campos
- cria o acordo
- chama `generate-agreement-boletos`
- fecha tudo corretamente

#### 3) Corrigir o botão “Pular (sem boleto)”
Hoje o botão tenta marcar `boleto_pendente` em um `pendingAgreement` que não existe.

Ajuste:
- o botão “Pular (sem boleto)” também deve usar o mesmo fluxo central de criação
- mas com override explícito, por exemplo:
  - `submitAgreement({ skipMissingCheck: true, markBoletoPendente: true })`

Comportamento esperado:
- cria o acordo normalmente
- marca `boleto_pendente = true`
- não chama a Edge Function de geração de boletos
- registra auditoria `acordo_criado_sem_boleto`

#### 4) Corrigir o texto mentiroso do modal
Trocar o texto atual:
- “O acordo foi criado com sucesso...”

Por algo correto, por exemplo:
- “Para formalizar o acordo e gerar o(s) boleto(s), preencha o(s) campo(s) abaixo.”

Isso alinha a UX com o estado real do sistema.

#### 5) Corrigir o fechamento do modal
Hoje `onOpenChange` chama `onAgreementCreated()` ao fechar o modal, mesmo sem acordo criado.

Ajuste:
- ao fechar o dialog por ESC/clique fora, apenas limpar:
  - `missingFieldsOpen`
  - `missingFields`
  - estados auxiliares de loading
- não chamar `onAgreementCreated()`
- não limpar/acusar acordo criado sem que ele exista

#### 6) Popular corretamente `foundFields`
O estado `foundFields` existe, mas não está sendo abastecido no fluxo exibido.

Ajuste:
- quando `checkRequiredFields()` retornar `consolidated` e `missing`, ao abrir o modal salvar:
  - `setFoundFields(post.consolidated)`

Resultado:
- a seção “Dados encontrados” passa a refletir os dados já existentes de verdade

### Desenho técnico sugerido

```text
Confirmar formalização
  -> handleConfirmedSubmit()
    -> submitAgreement({ skipMissingCheck: false, markBoletoPendente: false })

submitAgreement(...)
  -> se não for skipMissingCheck:
       checkRequiredFields()
       tentar enrichClientAddress()
       checkRequiredFields() novamente
       se ainda faltar:
         setFoundFields(post.consolidated)
         setMissingFields(post.missing)
         abrir modal
         return
  -> createAgreement(...)
  -> se markBoletoPendente:
       update agreements set boleto_pendente = true
       audit log
       não invocar boletos
     senão:
       invoke("generate-agreement-boletos")
  -> onAgreementCreated()
```

### Regras preservadas
- `client_profiles` continua como fonte canônica
- atualização em `clients` continua por retrocompatibilidade
- criação do acordo continua usando `createAgreement`
- geração de boletos continua usando a Edge Function `generate-agreement-boletos`
- fluxo fora do padrão (`pending_approval`) permanece intacto

### Validação esperada

1. Cliente sem e-mail:
   - clicar em formalizar
   - modal abre
   - preencher e-mail
   - clicar em “Salvar e Gerar Boletos”
   - acordo é criado e boletos são disparados

2. Após salvar e-mail:
   - nova tentativa no mesmo cliente não abre mais o modal se os dados estiverem completos

3. Clicar em “Pular (sem boleto)”:
   - cria acordo
   - marca `boleto_pendente = true`
   - não chama geração automática de boletos

4. Fechar modal por ESC/clique fora:
   - nada é salvo
   - nenhum acordo é criado
   - nenhuma atualização falsa ocorre

5. Se algum campo continuar vazio:
   - toast claro informando quais campos faltam
   - fluxo não segue silenciosamente

### Impacto
- 1 arquivo
- sem migração de banco
- sem mudança em edge functions
- correção localizada, com baixo risco de regressão e alto impacto operacional
