

## Corrigir nome da conversa no header (ChatPanel)

### Diagnóstico

A conversa atual da Renata Cibin tem no banco:
- `remote_phone = 5541998824444`
- `remote_name = ''` (vazio — o webhook mais recente não recebeu `pushName` do WhatsApp)
- `client_id = 41f07ea3…` (vinculada à Renata corretamente)

A `ConversationList` (lista lateral) já usa o fallback correto: `client_name || remote_name || remote_phone` → mostra "Renata Cibin do Nascimento".

O `ChatPanel.tsx` (header da conversa, linha 193) usa apenas `conversation.remote_name || conversation.remote_phone` — **ignora completamente o `client_name`**. Por isso o header mostra `5541998824444` enquanto a sidebar e o painel de contato mostram o nome.

Isso afeta **toda conversa cuja `remote_name` esteja vazia/nula mas tenha `client_id` vinculado** — caso comum em conversas criadas via campanha, via botão "Iniciar conversa" ou via webhooks que não trazem `pushName`.

### Correção

**Arquivo único: `src/components/contact-center/whatsapp/ChatPanel.tsx`**

- **Linha 193**: trocar
  ```tsx
  {conversation.remote_name || conversation.remote_phone}
  ```
  por
  ```tsx
  {clientInfo?.name || conversation.remote_name || conversation.remote_phone}
  ```
  
  O `clientInfo` já é passado como prop e contém o cliente vinculado (mesma fonte usada pelo painel direito "Contato"). Usá-lo como prioridade máxima resolve todos os casos em que há vínculo, independente do `remote_name` estar preenchido ou não.

- **Opcional (mesma linha 193)**: tratar o caso do `remote_name` ser igual ao `remote_phone` ou ao "system name" (mesma proteção que a `ConversationList` faz com `SYSTEM_NAME` na linha 389), evitando exibir o número duplicado quando `remote_name` é literalmente o telefone.

### Sem impacto

- A linha 248 (subtítulo) continua mostrando `remote_phone` — comportamento desejado.
- Backfill de `remote_name` no banco **não é necessário**: o frontend passa a derivar o nome do vínculo já existente.
- Nenhuma mudança em RPC, RLS, schema, webhooks ou outros componentes.
- Quando não há `client_id`, o comportamento permanece exatamente igual (cai em `remote_name → remote_phone`).

### Validação

1. Abrir a conversa da Renata Cibin (a atual, com `remote_name` vazio) → header deve mostrar "Renata Cibin do Nascimento" em vez do número.
2. Abrir conversa de cliente **não vinculado** (sem `client_id`) → continua mostrando `remote_name` ou o número (sem regressão).
3. Abrir conversa onde `remote_name` está preenchido e `client_id` aponta para outro nome → deve prevalecer o `client_name` (mais confiável que o `pushName` do WhatsApp).
4. Verificar nas demais conversas listadas se algum header que antes exibia número agora exibe corretamente o nome do cliente vinculado.

