

## Garantir histórico completo de mensagens (sem perdas ao fechar/reabrir conversa)

### Diagnóstico

**1. Tags/disposições — OK (sem alteração necessária)**
As tags ficam em `conversation_disposition_assignments` (linha por `conversation_id` + `disposition_type_id`). Fechar/reabrir a conversa não mexe nessa tabela — as tags são recarregadas do banco sempre que a conversa é selecionada. **Não há perda.**

**2. Mensagens — risco real de perda visual**
Em `WhatsAppChatLayout.tsx` (linha 362), a carga é:
```ts
fetchMessages(selectedConv.id).then((result) => setMessages(result.data))
```
e `fetchMessages` (em `conversationService.ts` linha 227) tem `pageSize=100` por padrão e **só busca a página 1**. Hoje nenhuma conversa passa de 100 mensagens (verificado no banco), então o sintoma ainda não apareceu — mas qualquer conversa que crescer perderá silenciosamente as mensagens mais antigas (são as que ficam de fora, pois a query ordena `created_at desc` e pega as 100 mais recentes).

Não existe nenhum mecanismo de "carregar mais antigas" no `ChatPanel` (busca por `loadMore/hasMore/onLoadMore` retornou zero ocorrências).

Ao fechar e reabrir a conversa, essa mesma carga roda de novo — então não se "perde" nada que já existia, mas também nunca exibe mensagens além das 100 mais recentes.

**3. Realtime (linhas 467-491) — OK**
INSERT/UPDATE em `chat_messages` filtrados por `conversation_id` atualizam o estado corretamente, com dedupe por `id`. Sem perda.

### Correção

**Aumentar o limite imediato + adicionar carregamento incremental ("carregar mensagens anteriores").**

#### `src/services/conversationService.ts`
- Manter `fetchMessages(conversationId, page, pageSize)` mas subir o default da primeira página de **100 → 200** (cobre 99% dos casos sem necessidade de scroll).
- Adicionar uma variante `fetchMessagesBefore(conversationId, beforeCreatedAt, pageSize)` que busca mensagens com `created_at < beforeCreatedAt` ordenadas desc, limitadas a `pageSize` (ex.: 100), e retorna `{ data, hasMore }`. Cursor por timestamp evita conflito com mensagens chegando em tempo real.

#### `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`
- Trocar a chamada da linha 362 para usar a nova versão paginada:
  - Carga inicial: chamar `fetchMessages(id)` (200 mais recentes) e guardar `oldestLoadedAt = messages[0]?.created_at` + `hasMoreOlder = result.hasMore`.
  - Expor `loadOlderMessages()` que chama `fetchMessagesBefore(id, oldestLoadedAt, 100)`, faz `setMessages((prev) => [...newOlder, ...prev])` (com dedupe por `id`) e atualiza `oldestLoadedAt` + `hasMoreOlder`.
- Passar `hasMoreOlder` e `onLoadOlder` como props ao `ChatPanel`.

#### `src/components/contact-center/whatsapp/ChatPanel.tsx`
- Acima da lista de mensagens (no topo do scroll container), renderizar condicionalmente um botão **"Carregar mensagens anteriores"** (variant `ghost`, ícone `ChevronUp`) quando `hasMoreOlder === true`.
- Ao clicar:
  1. Guardar `scrollHeight` antes.
  2. Chamar `onLoadOlder()`.
  3. Após render, ajustar `scrollTop` para `novoScrollHeight - scrollHeightAntigo` (mantém o usuário na mesma mensagem visível, sem "pular" para o topo).
- Sem auto-load por scroll (evita complicação de scroll position e race conditions com realtime). Botão explícito é mais previsível.

### Garantia "fechar → reabrir sem perder nada"

- Fechar a conversa só altera `conversations.status` para `closed` — **não toca em `chat_messages` nem em `conversation_disposition_assignments`**.
- Reabrir (status volta a `open`) é apenas update da mesma coluna.
- Ao selecionar a conversa novamente, o `useEffect` da linha 357 roda de novo: recarrega as 200 mensagens mais recentes (do banco — fonte da verdade), recarrega disposições/tags via o `useEffect` da linha 175 (que reexecuta porque `conversations` mudou via realtime), e o realtime continua subscrito.
- Nenhum estado relevante mora apenas em memória.

### Validação

1. Abrir conversa com >200 mensagens (criar manualmente se necessário) → ver as 200 mais recentes + botão "Carregar mensagens anteriores" no topo.
2. Clicar no botão → mensagens antigas aparecem acima sem o scroll pular.
3. Fechar a conversa (botão ✓) → reabrir (botão ↺) → todas as mensagens visíveis antes continuam acessíveis (200 iniciais + botão para carregar o restante). Tags continuam aplicadas.
4. Durante carregamento de antigas, receber uma mensagem nova em tempo real → mensagem nova aparece no fim normalmente, sem duplicar nem sumir.
5. Conversa pequena (<200 mensagens) → botão "Carregar anteriores" não aparece.

### Sem impacto

- Schema, RLS, RPCs, edge functions: nada alterado.
- Realtime subscriptions intactas.
- Tags/disposições: comportamento atual preservado (já é robusto).
- Performance: 200 mensagens iniciais é leve; carga incremental sob demanda.

