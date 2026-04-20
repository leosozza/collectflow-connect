

## Reaproveitar conversa existente do operador ao clicar em WhatsApp no perfil do cliente

### Problema atual

1. No perfil, ao clicar em WhatsApp, abre `StartWhatsAppConversationDialog` que **força escolher instância** e navega com `forceNew=1`.
2. No `WhatsAppChatLayout` (linhas 254-313):
   - Se a conversa existente está na **mesma instância selecionada** → abre ela (ok).
   - Se está em **outra instância** (mesmo que o operador também esteja vinculado a essa outra) → cai em `conflictState` (banner "criar nova / abrir existente") em vez de apenas abrir a existente.
   - Se não existe nenhuma → cria nova (ok).

Resultado: o operador acaba criando conversa duplicada com frequência, perdendo o histórico anterior.

### Comportamento desejado

> Se já existe conversa (status `open` ou `closed`, em qualquer instância à qual o operador esteja vinculado) com este cliente, **abrir essa conversa**, mesmo que esteja em instância diferente da selecionada.
> Apenas criar nova se realmente não existir nenhuma conversa nas instâncias visíveis ao operador.
> Conversas em status `waiting` continuam respeitando o fluxo de aceite (não são auto-abertas, mas devem ser priorizadas para seleção também — operador vê o banner de aceite).

### Mudanças

#### 1. `src/components/client-detail/StartWhatsAppConversationDialog.tsx`

Antes de navegar para o chat, **pré-checar se já existe conversa** para qualquer telefone do cliente nas instâncias permitidas ao operador:

- Adicionar query `existingConversations` que busca em `conversations` por:
  - `tenant_id = tenantId`
  - `instance_id IN (instances permitidas — já carregadas pelo dialog)`
  - `remote_phone` com sufixo de 8 dígitos batendo com qualquer dos `phoneOptions` (usar `.in('remote_phone', phonesE164)` + fallback `or` por sufixo via RPC simples no client com array)
  - Status `IN ('open','closed','waiting')`
  - Ordenar por `last_message_at desc`
- Se **encontrar** ≥1 conversa existente:
  - Substituir o footer/CTA por um aviso destacado: **"Já existe uma conversa em andamento com este cliente"** mostrando: instância, telefone, status (Open/Closed/Waiting), último contato.
  - Botão primário **"Abrir conversa existente"** → navega `?conversationId=<id>` (sem `forceNew`, sem `phone/instanceId`).
  - Botão secundário discreto **"Iniciar nova mesmo assim"** (apenas para admin) → mantém comportamento atual com `forceNew=1`. Para operador comum, **não exibir essa opção**.
- Se **não encontrar**:
  - Mantém o fluxo atual (escolher telefone + instância + `forceNew=1`).

#### 2. `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`

Adicionar suporte ao novo param `conversationId` no `useEffect` de auto-seleção (linhas 254-313):

- Se `searchParams.get("conversationId")` estiver presente:
  - Procurar a conversa na lista carregada; se achar, `setSelectedConv` e limpar param.
  - Se não achar (não está nas páginas já carregadas), fazer fetch direto em `conversations` por id e selecionar (mesmo padrão já usado pós-criação na linha 220-242).
  - Pular toda a lógica de `phone`/`forceNew`.

Ajustar também a lógica existente (linhas 281-312) para o caso em que **`forceNew` NÃO está presente** mas existe match em outra instância: hoje ela só prefere mesma instância e cai em `createConversationOnInstance` se não houver match em nenhuma. Reforço: quando `forceNew` é falso e há match em qualquer instância, **selecionar o match mais recente em vez de criar novo** (já existe parcialmente — confirmar que `matchingByPhone[0]` é selecionado quando não há `targetInstanceId` específico ou quando preferimos o mais recente).

#### 3. Sem mudanças

- RLS, RPCs, schema, edge functions: nada alterado.
- `ClientHeader.tsx` do atendimento (linha 109) que apenas faz `navigate(/contact-center/whatsapp?phone=...)` sem `forceNew` continua funcionando — já cai no caminho "abrir existente se houver".
- Banner de conflito (`conflictState`) permanece para o caso explícito de operador admin que escolhe forçar nova.

### Validação

1. Cliente Renata Cibin (já tem conversa fechada com Maria Eduarda em uma instância). Logar como Maria Eduarda → perfil da Renata → WhatsApp → o dialog deve avisar "Já existe conversa" e botão deve abrir a existente, **não criar nova**.
2. Cliente sem conversa nenhuma → dialog mostra normalmente os selects de telefone e instância → cria nova ao confirmar.
3. Cliente com conversa em instância à qual o operador **não está vinculado** → não conta como existente; dialog segue fluxo normal de criação.
4. Admin: ao detectar conversa existente, vê o aviso + opção secundária "Iniciar nova mesmo assim" (para casos legítimos).
5. Atendimento (`/atendimento`) → botão WhatsApp do `ClientHeader` continua abrindo a conversa existente se houver (já era esse comportamento).

