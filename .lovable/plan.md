
## Análise das duas issues

### Issue 1 — Filtro de Instâncias mostra todas, mesmo para operador
**Local:** `WhatsAppChatLayout.tsx` linha 60 chama `fetchWhatsAppInstances(tenantId)` sem filtrar por operador. Resultado: o `<Select>` "Instâncias" do `ConversationList` lista todas as instâncias do tenant para qualquer usuário.

**Solução:** Para usuários **não-admin**, restringir a lista às instâncias vinculadas em `operator_instances` (M2M já existente — ver memória `operator-instance-assignment`).

```ts
// pseudo
if (isAdmin) loadAll()
else loadAssignedTo(profile.id) // via operator_instances WHERE profile_id = me
```

Admins (`role in ('admin','super_admin')`) continuam vendo todas.

**Bonus consistente:** quando o operador tem 0 instâncias vinculadas, mostrar mensagem amigável ("Solicite ao administrador a vinculação a uma instância"). E ao filtrar conversas server-side, já existe `instanceFilter` — vamos passar a lista de instance_ids permitidas para garantir que mesmo conversas órfãs não apareçam (defesa em profundidade).

### Issue 2 — Filtro "Operadores" não retorna nada
**Causa raiz (confirmada em DB):** `conversations.assigned_to` armazena **`profiles.id`** (PK da tabela profiles), mas o dropdown de operadores no `ConversationList` usa **`profiles.user_id`** (auth UID) como `value`. A RPC `get_conversations_paginated` compara `v.assigned_to = _operator_filter` → IDs nunca batem → 0 resultados.

Exemplo Y.BRASIL: 158 conversas têm `assigned_to` setado, mas todos com `profiles.id` (ex.: `7873f5e6...`). O dropdown envia `user_id` (`33a1585b...`). Sem match.

**Solução:** padronizar o dropdown para usar `profiles.id` (mesmo valor que está em `assigned_to`).

```ts
// WhatsAppChatLayout.tsx (carregamento de operadores)
.select("id, user_id, full_name")
setOperators(data.map(p => ({ id: p.id, name: p.full_name }))) // usar p.id, não p.user_id
```

Nenhuma mudança de schema/RPC necessária. Só alinhamento de identificadores no frontend.

### Mudanças propostas (apenas frontend)

**`src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`**
1. Trocar `setOperators(p.user_id → p.id)` para alinhar com `assigned_to`.
2. Após `fetchWhatsAppInstances`, se o usuário **não for admin**, filtrar pelas instâncias presentes em `operator_instances` (`profile_id = profile.id`). Buscar essa lista via Supabase no mesmo `useEffect`.
3. Se `instances.length === 0` para operador, exibir aviso (passa array vazio).

**Sem alterações em:**
- RPC `get_conversations_paginated` (continua funcionando — só estava recebendo o ID errado)
- `ConversationList.tsx` (já consome `instances` e `operators` como props)
- Backend / RLS / migrations

### Detalhes técnicos
- `isAdmin` derivado de `profile?.role === 'admin'` ou `'super_admin'` (mesma checagem usada no ChatPanel para "Accept-to-Read").
- Filtro de instâncias no operador: `supabase.from('operator_instances').select('instance_id').eq('profile_id', profile.id)` → intersecta com `fetchWhatsAppInstances`.
- Operadores no dropdown: continuar restrito a `isAdmin` (já é).
