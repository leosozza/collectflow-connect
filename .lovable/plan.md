
## Correções na Lista de Conversas do WhatsApp

### Problemas identificados

**Problema 1 — "Temis Connect Pay" em vez do nome do contato**
No webhook (`whatsapp-webhook/index.ts`), quando uma mensagem é enviada pela empresa (`fromMe: true`), o `pushName` retorna o nome da conta da instância. O webhook atualiza o `remote_name` com esse valor, sobrescrevendo o nome correto do contato. A correção é: só atualizar `remote_name` quando a mensagem for de entrada (`direction === "inbound"` / `fromMe === false`).

**Problema 2 — Lista cortando**
O `ConversationList` não tem `overflow-hidden` no container do texto. O nome usa `truncate` mas o `flex` externo não limita o espaço, deixando o conteúdo vazar. Além disso, o layout geral (`WhatsAppChatLayout`) dá `w-[320px] shrink-0` à lista — em telas menores isso pode fazer a barra lateral do Contact expulsar a lista.

**Problema 3 — Foto/avatar genérico**
Quando a conversa tem um `client_id` vinculado, deve mostrar as iniciais do nome do cliente no avatar. Quando não tem, mostrar as iniciais do `remote_name`. Só cair para o ícone de usuário se não houver nenhum nome disponível.

**Problema 4 — "Temis Connect Pay" em conversas existentes sem client_id**
As conversas que já têm `remote_name = "Temis Connect Pay"` precisam exibir o número de telefone como identificador na lista (o que já acontece na segunda linha), mas o nome principal deve mostrar algo mais útil: o nome do cliente vinculado quando disponível.

---

### Solução

**1. Corrigir o webhook — não sobrescrever `remote_name` com `pushName` de mensagens enviadas**

`supabase/functions/whatsapp-webhook/index.ts` — linha 202:

```js
// ANTES (errado): sempre atualiza com pushName
remote_name: pushName || undefined,

// DEPOIS (correto): só atualiza se for mensagem recebida (inbound)
remote_name: direction === "inbound" && pushName ? pushName : undefined,
```

Isso preserva o nome correto do contato e não deixa o sistema sobrescrever com o nome da conta.

**2. Enriquecer as conversas com nome do cliente vinculado**

Em `fetchConversations` (`conversationService.ts`), fazer join com a tabela `clients` para trazer `nome_completo` quando `client_id` existir. Atualizar a interface `Conversation` para incluir `client_name?: string`.

Alternativa mais simples (sem alterar a query do servidor): no `WhatsAppChatLayout`, após carregar as conversas, enriquecer localmente com os dados do cliente — porém isso causaria N+1 queries. A melhor abordagem é alterar o `fetchConversations` para fazer um select com join.

**3. Melhorar o avatar — iniciais coloridas**

Em `ConversationList`, substituir o ícone genérico `<User>` por um componente de avatar com iniciais:
- Se a conversa tem `client_name`, usar as iniciais do cliente com cor baseada no hash do nome
- Senão, usar as iniciais do `remote_name` se não for "Temis Connect Pay"
- Fallback: ícone de `User`

**4. Corrigir o truncamento do texto**

Em `ConversationList`, adicionar `overflow-hidden` no div flexível que contém nome + timestamp para garantir que o `truncate` funcione corretamente:

```tsx
// ANTES
<div className="flex-1 min-w-0">
  <div className="flex items-center justify-between">
    <span className="font-normal text-[15px] text-foreground truncate">

// DEPOIS — adicionar overflow-hidden no container interno também
<div className="flex-1 min-w-0 overflow-hidden">
  <div className="flex items-center justify-between gap-1">
    <span className="font-normal text-[15px] text-foreground truncate flex-1 min-w-0">
```

---

### Arquivos a modificar

- `supabase/functions/whatsapp-webhook/index.ts` — não sobrescrever `remote_name` quando `fromMe = true`
- `src/services/conversationService.ts` — enriquecer fetch com nome do cliente via join
- `src/components/contact-center/whatsapp/ConversationList.tsx` — avatar com iniciais + fix truncamento

### Nenhuma migração SQL necessária.
### Nenhuma nova dependência necessária.
