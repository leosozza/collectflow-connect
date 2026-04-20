

## Modo somente-leitura para admin/supervisor em conversas de outro operador

### Problema

Em `WhatsAppChatLayout.tsx`, quando qualquer usuário abre uma conversa, o sistema chama `markConversationRead` (zera `unread_count`) e também marca como lida a cada nova mensagem inbound recebida no realtime. Resultado: se um admin/supervisor abre a conversa de um operador, o badge "2" desaparece para todos — o operador responsável perde o indicador visual de que ainda não atendeu.

### Regra desejada

- A conversa só é marcada como lida quando o **operador responsável** (`assigned_to === currentUser.id`) a abre.
- Admin, supervisor ou qualquer outro usuário: **modo espectador** — visualiza a thread, mas o `unread_count` permanece intacto, o status não muda e nenhuma mensagem é marcada como lida.
- Conversas sem `assigned_to` (em `waiting`, ainda não aceitas): mantém o comportamento atual de "accept-to-read" — ninguém zera ao só abrir.

### Mudanças

**`src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`**

1. Criar helper local `isResponsibleOperator(conv)`:
   ```ts
   const currentUserId = profile?.user_id || profile?.id;
   const isResponsibleOperator = (conv) =>
     !!conv?.assigned_to && !!currentUserId && conv.assigned_to === currentUserId;
   ```
   (Observação importante: a regra **não** depende mais de `role === "admin"`. Admin que não é o operador responsável **também** entra em modo espectador. A capacidade de admin de assumir/transferir continua disponível pelos botões existentes da UI — só a marcação automática de leitura é bloqueada.)

2. Linha 392–396 (effect ao trocar `selectedConv`): substituir a condição atual por:
   ```ts
   if (isResponsibleOperator(selectedConv)) {
     markConversationRead(selectedConv.id).catch(console.error);
   }
   ```
   Remove a marcação tanto para `waiting` quanto para conversas atribuídas a outro operador.

3. Linha 527–529 (handler realtime de novas mensagens inbound): mesma checagem antes de chamar `markConversationRead`. Se o espectador estiver com a tela aberta e chegar uma nova msg, o contador continua incrementando para o operador responsável.

4. Em `ChatPanel`/`ChatInput` já existe trava de envio quando o usuário não é o responsável? Conferir e, se não houver, **não** alterar agora — o escopo do pedido é apenas "não interferir na contagem/leitura". Caso o input esteja liberado para admin, manter como está (admin pode responder se quiser; mas não marca como lida automaticamente só por abrir).

### Validação

1. Operador A é o `assigned_to`. Cliente envia 2 mensagens → badge "2" na lista para todos.
2. Supervisor abre a conversa → mensagens aparecem, badge **continua "2"**, `unread_count` no banco permanece 2.
3. Cliente envia 3ª mensagem com supervisor ainda olhando → badge vira "3" para todos (inclusive na lista do operador A).
4. Operador A abre a conversa → badge zera para todos; realtime das próximas inbound também zera enquanto ele estiver dentro.
5. Admin abre uma conversa **sem** `assigned_to` (status `waiting`) → não marca como lida (mantém regra accept-to-read atual).
6. Admin é o próprio `assigned_to` de outra conversa → marca como lida normalmente ao abrir.

Sem mudanças de schema, sem migrations, sem novas RPCs.

