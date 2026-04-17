

## Diagnóstico — Lista de conversas vazia para operadores

### Causa raiz
Na RPC `get_visible_conversations` (SECURITY DEFINER), a regra de visibilidade compara identificadores incompatíveis:

```sql
OR c.assigned_to = _user_id   -- ❌ _user_id = auth.uid() (Auth UID)
```

Mas `conversations.assigned_to` armazena **`profiles.id`** (PK da tabela profiles). Confirmado em produção:
- Y.BRASIL tem 158 conversas com `assigned_to` setado, todas com `profiles.id` (ex: `7873f5e6...` = Gustavo abade)
- Nenhuma bate com `auth.uid()` → **operador vê 0 conversas**

Isso explica o sintoma da imagem: contadores corretos (62 / 9 / 134, vindos de `fetchConversationCounts` que faz query direta), mas lista vazia ("Nenhuma conversa encontrada") porque a RPC filtra tudo fora.

Esse é o mesmo bug `profile.id` vs `user_id` que já corrigimos no frontend para o filtro de "Operadores", agora no servidor.

### Bug secundário detectado
A query `fetchConversationCounts` **não aplica regra de visibilidade** — conta todas as conversas do tenant, não as visíveis ao operador. Por isso o operador vê "Aberta 62" no badge mas não consegue acessar nenhuma. Os contadores estão mentindo.

### Correções

**1. Migration: corrigir RPC `get_visible_conversations`**

Substituir todas as comparações `assigned_to = _user_id` por `assigned_to = _profile_id`:

```sql
OR c.assigned_to = _profile_id   -- ✅ usa profiles.id
```

(`_profile_id` já é resolvido na função via `SELECT id FROM profiles WHERE user_id = _user_id`)

**2. Migration: criar RPC `get_visible_conversation_counts`**

Nova função SECURITY DEFINER que retorna `{open, waiting, closed, unread}` aplicando exatamente a mesma regra de visibilidade da `get_visible_conversations`. Garante que os badges reflitam o que o operador realmente vê.

**3. Frontend: `conversationService.ts`**

Em `fetchConversationCounts`, para não-admin chamar a nova RPC. Para admin, manter query direta atual.

**4. Frontend: `WhatsAppChatLayout.tsx`**

Passar `isAdmin` para `fetchConversationCounts` (igual ao que já é feito em `fetchConversations`).

### Sem mudanças em
- Schema de tabelas
- RLS policies
- `ConversationList.tsx` (já consome `statusCounts` como prop)
- Lógica de filtros, paginação, realtime

### Resultado esperado
- Operador Y.BRASIL passará a ver as conversas onde `assigned_to = seu_profile_id`
- Badges vão refletir só o que ele pode acessar
- Admins continuam vendo tudo (sem regressão)

