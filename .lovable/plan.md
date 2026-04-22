

## Plano: Opção A — esconder operador atribuído quando conversa está em "Aguardando"

### Comportamento

Na lista de conversas (`ConversationList`) da Inbox WhatsApp, quando `status === 'waiting'`:

- **Esconder** avatar e nome do operador (`assigned_to`) do item da lista.
- **Manter visível** apenas o badge "Aguardando aceite" (já existente).
- Para `status === 'open'` ou `'closed'`: comportamento atual preservado (mostra operador).

Dado preservado intacto no banco — apenas mudança visual.

### Arquivo alterado

- `src/components/contact-center/whatsapp/ConversationList.tsx` — envolver o bloco de exibição do operador atribuído em condicional `conversation.status !== 'waiting' && (...)`.

### Validação

1. Cliente em conversa fechada manda nova mensagem → conversa volta para "Aguardando".
2. Na lista, item aparece **apenas com badge "Aguardando aceite"**, sem avatar/nome do operador anterior.
3. Após aceitar (status vira `open`) → operador volta a aparecer normalmente.
4. Conversas fechadas continuam mostrando o último operador (histórico).

### Fora de escopo

- Alterações no banco ou em `assigned_to`.
- Mudança no fluxo de aceite ou bloqueio de envio (já corretos).

