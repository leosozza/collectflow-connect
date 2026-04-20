

## Refinamentos UX Premium do WhatsApp

Plano dividido em 6 melhorias independentes sobre o módulo `src/components/contact-center/whatsapp/`.

### 1. Infinite Scroll reverso no histórico

**`ChatPanel.tsx`**
- Remover o botão "Carregar mensagens anteriores".
- Adicionar `onScroll` no viewport do `ScrollArea` (`[data-radix-scroll-area-viewport]`):
  - Quando `scrollTop < 80px` && `hasMoreOlder` && `!loadingOlder` → disparar `onLoadOlder()`.
  - Debounce simples via flag local (`isFetchingRef`) para não chamar várias vezes durante o mesmo scroll.
- Preservar a posição: antes da chamada, salvar `prevHeight = viewport.scrollHeight` e `prevTop = viewport.scrollTop`. Após `messages` mudar (via `useLayoutEffect` com dependência `messages.length`), aplicar `viewport.scrollTop = viewport.scrollHeight - prevHeight + prevTop`. Manter o ajuste já existente.
- **Skeleton**: enquanto `loadingOlder === true`, renderizar no topo da lista 3 `<Skeleton>` em formato de bolha (alternando esquerda/direita, `h-12 w-2/3 rounded-2xl`) dentro de um wrapper `animate-fade-in`.

### 2. SLA Visual

**`ConversationList.tsx`**
- Criar helper `getSlaColor(conv)` baseado em `conv.last_message_at` + janela de 24h da política WhatsApp já usada no projeto (consultar lógica existente em `WhatsAppChatLayout` ou no badge de SLA do `ChatPanel`):
  - `> 4h` restante → `ring-green-500`
  - `1h–4h` → `ring-orange-500`
  - `< 1h` → `ring-red-500 animate-pulse`
- Aplicar como `ring-2 ring-offset-1` no `Avatar` da conversa quando status for `open` ou `waiting` (não aplicar em `closed`).

**`ChatPanel.tsx`**
- No badge SLA já existente no header, adicionar classe condicional `animate-pulse` quando tempo restante `< 1h`.

### 3. Triage Mode — tags/tabulação visíveis em `waiting`

**`ConversationList.tsx`**
- Hoje conversas em `waiting` têm prévia/última mensagem borrada (`blur-sm` ou similar). Garantir que o container de tags/disposições renderizado no item NÃO receba a classe de blur — extrair para um nó irmão fora do wrapper borrado.

**`ChatPanel.tsx` (header)**
- Quando `status === "waiting"`, manter o bloco de tags + disposições renderizado no header com opacidade total (sem blur), ainda que o corpo das mensagens fique bloqueado pela tela de "Aceitar conversa".

### 4. Proteção de conversas fechadas

**`ChatInput.tsx`**
- Receber nova prop `conversationStatus?: "open" | "waiting" | "closed"` (passar do `ChatPanel`/`WhatsAppChatLayout`).
- Quando `conversationStatus === "closed"` && `text.length > 0`:
  - Renderizar acima do textarea um aviso sutil (bg `amber-50 dark:amber-950/30`, ícone `AlertTriangle`, texto: "Você está respondendo a uma conversa fechada. Isso irá reabri-la automaticamente.").
  - Trocar a cor do botão Send para `bg-amber-500 hover:bg-amber-600` (sobrescreve o `bg-primary`).
- Sem mudança de comportamento de envio — a reabertura já acontece no backend/realtime quando uma nova mensagem outbound entra.

### 5. Typing Indicator (Cliente digitando)

**Backend (Supabase Realtime — Presence/Broadcast, sem persistência)**
- Usar canal Supabase **Broadcast** por conversa: `whatsapp-typing-{conversation_id}`.
- O webhook de ingestão da Gupshup/Evolution (quando o provedor envia evento `composing`/`typing`) fará `supabase.channel(...).send({ type: 'broadcast', event: 'typing', payload: { conversation_id, until: now+5s } })`.
  - **Importante:** verificar se os webhooks atuais (`gupshup-webhook`, `evolution-webhook`) já recebem evento de typing dos provedores. Se não receberem, **pular esta sub-feature** e marcar como "depende de provedor". Confirmar com leitura das edge functions antes de implementar — se ausente, o typing fica para uma próxima iteração.
- Frontend:
  - Hook `useTypingIndicator(conversationId)` que retorna `boolean` (true por 5s após receber evento, auto-reset).
  - Subscrição feita no `WhatsAppChatLayout` para a conversa selecionada (header) e, na lista, subscrição em todas conversas visíveis seria custosa → **manter typing apenas no header do `ChatPanel`** e **não** na lista (decisão de performance).
  
**`ChatPanel.tsx` (header)**
- Quando `isTyping === true`, abaixo do nome do cliente, mostrar componente `TypingDots` (três bolinhas animadas via Tailwind: `animate-bounce` com delays escalonados 0/150/300ms) + texto "digitando…".

### 6. Filtro de Tabulação colorido

**`ConversationList.tsx`**
- No `SelectTrigger` do filtro de tabulação:
  - Quando `dispositionFilter !== "all"`, calcular `selectedDisp = dispositionTypes.find(d => d.id === dispositionFilter)`.
  - Aplicar `style={{ color: selectedDisp.color }}` no ícone `Tag`.
  - Manter texto do label normal (legibilidade).

### Sem mudanças

- Schema, RLS, RPCs (exceto possível ajuste de webhook se typing for viável — analisar antes).
- Lógica de fechamento/reabertura de conversa (já está no fluxo de envio).
- Estilos globais.

### Validação

1. Abrir conversa com >200 mensagens, rolar para o topo → carga automática + skeletons no topo, scroll permanece "ancorado" sem pulo.
2. Lista: avatares com aros verde/laranja/vermelho conforme tempo desde última mensagem; aros vermelhos pulsam.
3. Header de conversa com SLA < 1h: badge pulsa.
4. Conversa em "waiting": tags e tabulação visíveis e nítidas (sem blur), tanto na lista quanto no header.
5. Conversa fechada: digitar → alerta âmbar aparece e botão fica âmbar; ao enviar, conversa reabre.
6. Typing: provedor envia evento `composing` → header mostra "digitando…" com 3 pontos animados; some após 5s sem novo evento. Se provedor não enviar, sub-feature documentada como pendente.
7. Filtro de tabulação: selecionar uma → ícone Tag fica na cor da tabulação; voltar para "Todas" → ícone volta ao normal.

