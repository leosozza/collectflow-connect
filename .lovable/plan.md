## Objetivo

Dois ajustes no módulo WhatsApp:

1. **Busca por nome completo** na lista de conversas (Contact Center → WhatsApp): hoje só acha se o termo aparece exatamente em `remote_name`. Digitar o sobrenome não encontra o cliente.
2. **Diálogo de WhatsApp no perfil do cliente**: ao clicar no botão WhatsApp no perfil, mostrar **todas as instâncias que já têm conversa aberta com o cliente** e permitir ao operador iniciar uma **nova conversa por outra instância**.

---

## Ajuste 1 — Busca de conversas por nome/sobrenome

### Problema atual

Em `src/services/conversationService.ts` a busca envia uma string única:
- **Operador**: RPC `get_visible_conversations` faz `conv_remote_name ILIKE '%termo%' OR conv_remote_phone ILIKE '%termo%'`.
- **Admin**: query direta com `remote_name.ilike.%s% OR remote_phone.ilike.%s%`.

Isso falha quando:
- O termo digitado tem 2+ palavras em ordem diferente do `remote_name` (ex.: `remote_name = "João"` mas operador digita "João Silva").
- O nome cadastrado em `clients.nome_completo` difere do `remote_name` (foto/nome do WhatsApp ≠ nome cadastral). Hoje a busca **não considera `clients.nome_completo`** para operadores e nem para admins.

### Solução

**a) RPC `get_visible_conversations` e `get_visible_conversation_counts`** — nova migration que substitui a função:
- Trocar bloco de busca por: para cada palavra (token) de `_search` separada por espaços, exigir que **TODAS** apareçam em pelo menos um destes campos concatenados: `coalesce(remote_name,'') || ' ' || coalesce(remote_phone,'') || ' ' || coalesce(client_name,'')` (usando `unaccent` + `ILIKE '%token%'`).
- Incluir o JOIN com `clients` (já é feito ao final para `client_name`) **antes** do filtro, para que `client_name` participe do match.
- Garantir uso de `unaccent` (extensão já habilitada nas RPCs do projeto — verificar; se não, instalar via `CREATE EXTENSION IF NOT EXISTS unaccent`).

**b) Branch admin em `fetchConversations`** — atualizar o `or(...)` para o mesmo comportamento:
- Tokenizar `filters.search` por espaços.
- Como PostgREST não permite AND de múltiplos `ilike` em campos diferentes facilmente, **migrar admins para também usar a RPC** (recomendado) ou aplicar `ilike` por token com filtros encadeados em um campo concatenado virtual via uma nova RPC `search_conversations_admin`. Decisão: **unificar admins na mesma RPC** com um parâmetro `_admin boolean` que ignora a regra de visibilidade — mais simples e consistente.

**c) Frontend `ConversationList.tsx`** — sem mudanças de UI; o input segue passando o texto bruto para `onFiltersChange`.

### Comportamento resultante

- Digitar "joão silva" encontra conversa cujo `client_name = "João da Silva"` mesmo que `remote_name = "Joãozinho"`.
- Digitar parte do telefone segue funcionando (token único cai no `remote_phone`).
- Acentos são ignorados.

---

## Ajuste 2 — Diálogo "Abrir conversa no WhatsApp" do perfil do cliente

### Estado atual

`src/components/client-detail/StartWhatsAppConversationDialog.tsx`:
- Mostra lista de telefones do devedor + lista de instâncias permitidas.
- Faz pre-check de conversas existentes filtrando por **sufixo do telefone selecionado** e mostra apenas a **mais recente** (`topExisting`) num único bloco "Já existe conversa para este número".
- Botão "Abrir existente" abre só essa última. Não há visão por instância.

### Mudanças

**a) Carregar todas as conversas existentes do cliente em paralelo, agrupadas por instância:**
- Trocar o pre-check para buscar conversas onde:
  - `tenant_id = tenantId`
  - `instance_id IN allowedInstanceIds`
  - `client_id = client.id` **OU** sufixo de `remote_phone` ∈ {sufixos de todos os telefones do devedor} (cobre conversas ainda não vinculadas).
  - `status IN ('open','waiting')` (apenas conversas **abertas** — fechadas não bloqueiam).
- Resultado agrupado por `instance_id`: `{ instance, conversation }[]`.

**b) Nova seção "Conversas em andamento" no diálogo (acima dos selects):**
- Renderiza um cartão por instância com conversa aberta:
  - Nome da instância + badge "Oficial" se aplicável.
  - Telefone, status, último contato.
  - Botão "Abrir conversa" → navega para `/contact-center/whatsapp?conversationId=...`.
- Se não houver conversa aberta em nenhuma instância → não exibe a seção.

**c) Seção "Iniciar nova conversa" (parte de baixo, mantida):**
- Selects de telefone + instância continuam.
- A lista de instâncias **não filtra** as que já têm conversa aberta — o operador pode escolher qualquer instância permitida (inclusive uma diferente das que já têm conversa em andamento) para iniciar nova conversa.
- Se a instância escolhida já tiver conversa aberta com o número, exibir aviso curto ("Já existe conversa aberta nesta instância — abrir nova criará outra entrada") sem bloquear.
- Botão "Abrir nova conversa" navega com `forceNew=1` (já implementado).

**d) Loading/empty state ajustados** para refletir a nova consulta agrupada.

---

## Detalhes técnicos

### Arquivos a editar/criar

- `supabase/migrations/<timestamp>_whatsapp_conversation_search_multitoken.sql` — recria `get_visible_conversations` (e mantém assinatura) com:
  - Lógica multi-token usando `string_to_array(lower(unaccent(_search)), ' ')`.
  - Inclui `clients.nome_completo` no haystack.
  - Aceita parâmetro adicional opcional `_admin boolean DEFAULT false` que pula o filtro de visibilidade por operador (mantém compatibilidade — chamadas atuais sem o parâmetro continuam funcionando).
- `src/services/conversationService.ts`:
  - Branch admin passa a chamar a RPC com `_admin: true`.
  - Branch operador adiciona `_admin: false`.
- `src/components/client-detail/StartWhatsAppConversationDialog.tsx`:
  - Substituir query única por query agrupada (todas as instâncias permitidas, todos os sufixos do cliente, status `open|waiting`).
  - Renderizar lista de cartões "Conversas em andamento por instância".
  - Manter selects de "Iniciar nova conversa".

### Compatibilidade

- A RPC mantém colunas de retorno e parâmetros existentes; só adiciona `_admin` opcional ao final → chamadas atuais não quebram.
- `forceNew=1` já é tratado pelo Contact Center; nada a alterar lá.

### Riscos e mitigação

- **Performance da RPC** com unaccent + ILIKE multi-token: aceitável em volumes atuais (RPC já roda em windows paginados); se necessário, criar índice `GIN` em `unaccent(remote_name)` futuramente.
- **Privacidade**: o branch admin passa a expor todas as conversas via RPC com `_admin=true`, mas a RPC valida `auth.uid()` ↔ `tenant` e papel admin internamente antes de pular o filtro de operador (será implementado dentro da função usando `is_tenant_admin(auth.uid(), _tenant_id)`).

---

## Resultado esperado

1. Operador digita "Maria Souza" e encontra a conversa mesmo que o WhatsApp do contato exiba "Mari" — porque o `clients.nome_completo` cadastrado é "Maria Souza".
2. Ao clicar no botão WhatsApp do perfil do cliente, o diálogo lista **todas as instâncias** com conversa aberta para aquele cliente (cada uma com seu botão "Abrir") e permite escolher qualquer instância autorizada para começar uma nova conversa.
