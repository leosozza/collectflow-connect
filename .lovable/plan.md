

## Plano: corrigir lentidão de envio + bolinha verde que não zera

### Problema 1 — Bolinha verde de não-lidas não zera ao abrir a conversa

**Causa raiz** (`WhatsAppChatLayout.tsx` linhas 392-399 e 529-536):

```ts
const isResponsibleOperator =
  !!selectedConv.assigned_to && !!currentUserId && selectedConv.assigned_to === currentUserId;
if (isResponsibleOperator) {
  markConversationRead(selectedConv.id).catch(console.error);
}
```

A regra "spectator mode" só zera `unread_count` quando o operador é o **responsável** (`assigned_to == userId`). Como muitas conversas hoje **não têm operador atribuído** ou estão atribuídas a outra pessoa, ao abrir a conversa o badge verde **nunca zera**.

**Correção**: a bolinha de não-lidas é uma marcação **visual de leitura por operador que está visualizando**, não um "fui eu que respondi". Vamos:

- **Sempre zerar `unread_count`** quando qualquer operador autorizado abrir a conversa (mesmo sem ser o responsável).
- Manter a regra "spectator mode" apenas para o que ela faz sentido: **não enviar resposta automática / não tomar a conversa**, mas a leitura visual deve refletir.
- Aplicar o mesmo nos dois pontos: ao selecionar a conversa (linha 396) e quando chega nova mensagem com a conversa aberta (linha 533).

Resultado: clicou na conversa → bolinha some imediatamente e o contador do filtro "não-lidas" também atualiza (já existe invalidate do `conversation-counts` via realtime).

### Problema 2 — Lentidão percebida no envio de mensagem

Causas concorrentes:

**A. Sem UI otimista** (`WhatsAppChatLayout.tsx` linha 563-578)
A mensagem só aparece na tela quando volta do servidor (após chamar edge `send-chat-message` → enviar pelo Evolution → persistir → trigger Realtime → `setMessages`). Em conexões médias isso é 1.5–4s — operador vê só o spinner.

**Correção**: inserir uma "mensagem otimista" no `setMessages` imediatamente ao clicar enviar, com `id` temporário e `status: 'sending'`. Quando a real chegar via Realtime (mesmo conteúdo, mesma conversa, próximos segundos), substituir pelo registro real. Em caso de erro, marcar a otimista como `failed` com botão de reenvio.

**B. Edge function `send-chat-message` faz 7+ queries sequenciais** (`supabase/functions/send-chat-message/index.ts`)

Hoje a sequência é:
1. `getClaims` (auth)
2. SELECT `tenant_users`
3. SELECT `conversations`
4. SELECT `whatsapp_instances`
5. SELECT `tenants` (settings)
6. **HTTP send Evolution/Gupshup** ← único trabalho real
7. RPC `ingest_channel_event`
8. SELECT `profiles` (sender)
9. SELECT `conversations` (owner)
10. UPDATE `conversations` (status/assigned)

Cada query Supabase = 80-200ms. Pré-envio são ~600-1200ms desperdiçados.

**Correção**: 
- Paralelizar passos 2-5 com `Promise.all` (são independentes entre si exceto que 4 depende de 3 — paralelizar 2 + (3→4 sequencial) + 5).
- Eliminar passos 8 e 9 fazendo um único UPDATE condicional usando subquery na 10 (`assigned_to = COALESCE(assigned_to, (select id from profiles where user_id = $1))`).
- Combinar a leitura do dono da conversa em (3): já trazer `assigned_to` no SELECT da conversa.

Estimativa: **600-800ms** a menos de latência por mensagem.

**C. Canal Realtime de mensagens com nome fixo** (linha 519)

```ts
.channel("messages-realtime")
```

Nome fixo provoca conflito quando o usuário troca de conversa rapidamente — o canal antigo pode ainda estar fechando enquanto o novo abre, e a primeira mensagem da nova conversa pode "perder" o evento.

**Correção**: usar `supabase.channel(\`messages-${selectedConv.id}\`)` (nome único por conversa). Idem para o canal `conversations-realtime`, escopar por `tenantId`.

### Arquivos alterados

1. `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`
   - Remover gating "spectator mode" do `markConversationRead` (linhas 392-399 e 529-536).
   - Adicionar UI otimista no `handleSend`: inserir mensagem temporária em `messages` com `status: 'sending'`; substituir/atualizar quando o real chegar; marcar `failed` se a edge retornar erro.
   - Renomear canais Realtime para incluir `id` único.

2. `supabase/functions/send-chat-message/index.ts`
   - Paralelizar SELECTs com `Promise.all` (tenant_users, tenants, e a cadeia conversation→instance).
   - Eliminar SELECT de `profiles` e SELECT de `conversations`(owner) — fazer UPDATE único com `COALESCE` para auto-assign.
   - Trazer `assigned_to` no SELECT inicial de `conversations`.

3. `src/services/conversationService.ts`
   - Sem mudanças funcionais; `markConversationRead` continua igual.

### Validação

1. **Bolinha**: abrir conversa com 4 mensagens não lidas (sem ser o responsável) → contador verde some imediatamente; contador "não lidas" no filtro também desce.
2. **Latência**: enviar mensagem em conversa ativa → texto aparece **instantaneamente** na tela com indicador "enviando…", e em ~1s troca para "enviado/entregue".
3. **Erro de envio**: simular instância offline → mensagem otimista vira "falha" com botão de retry, sem travar o input.
4. Trocar de conversa rapidamente 5x seguidas → cada conversa exibe corretamente as próprias mensagens em tempo real (sem "fantasma" de conversa anterior).

