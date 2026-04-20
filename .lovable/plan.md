

## Exibir foto de perfil real dos clientes no WhatsApp

### Diagnóstico atual

- A tabela `public.conversations` **não possui** coluna para foto do cliente (`remote_avatar_url` / `profile_pic_url`).
- Nenhum webhook (`whatsapp-webhook`, `gupshup-webhook`) lê ou persiste a foto do contato hoje — apenas `pushName` / `sender.name`.
- O componente `ConversationAvatar` em `ConversationList.tsx` renderiza somente as iniciais via `<AvatarFallback>` (não há `<AvatarImage>`).

### Viabilidade por provedor

| Provedor | Foto disponível? | Como obter |
|---|---|---|
| **Evolution API** (não-oficial) | Sim | Endpoint `POST /chat/fetchProfilePictureUrl/{instance}` retorna `{ profilePictureUrl }` |
| **Wuzapi** (não-oficial) | Sim | Endpoint `GET /user/avatar?phone=...` |
| **Gupshup oficial (Meta Cloud API)** | Não | Meta não expõe a foto de contatos por questões de privacidade. Fallback: iniciais |

### Mudanças propostas

**1. Schema (migração)**
- Adicionar em `public.conversations`:
  - `remote_avatar_url TEXT NULL`
  - `remote_avatar_fetched_at TIMESTAMPTZ NULL` (para cache/refresh)
- Sem RLS adicional (herda das policies existentes).
- Atualizar a RPC `get_visible_conversations` para retornar `remote_avatar_url` no `RETURNS TABLE`.

**2. Backend — captura sob demanda (lazy + cache)**

Nova edge function `whatsapp-fetch-avatar` (POST, JWT-auth, `tenant_id` validado):
- Input: `{ conversation_id }`.
- Lê `instance_id` + `provider_category` da conversa.
- Roteia:
  - `evolution` → chama `evolution-proxy` action `fetchProfilePictureUrl` (criar este action no proxy se não existir).
  - `wuzapi` → chama `wuzapi-proxy` action equivalente.
  - `official_meta` (Gupshup oficial) → retorna `null` imediatamente (sem chamada).
- Persiste resultado em `conversations.remote_avatar_url` + `remote_avatar_fetched_at`.
- TTL: se `fetched_at < 7 dias` retorna o cache sem chamar provedor.

**Por que lazy e não no webhook?** Buscar a foto a cada mensagem inbound geraria 1 request HTTP extra por mensagem para a Evolution/Wuzapi, com risco de rate-limit. Buscar 1x por conversa (com TTL) é o padrão recomendado.

**3. Frontend**

`ConversationList.tsx` → `ConversationAvatar`:
- Adicionar `<AvatarImage src={conv.remote_avatar_url ?? undefined} />` antes do `<AvatarFallback>`. O Radix Avatar já faz fallback automático se a imagem falhar.
- Hook `useConversationAvatars(conversations)`:
  - Para cada conversa visível com `remote_avatar_url === null` && `remote_avatar_fetched_at === null` (nunca tentado), enfileira chamada à edge `whatsapp-fetch-avatar` em batches de 5 (debounce 300ms ao scrollar).
  - Conversa cuja tentativa falhou (fetched_at preenchido mas url null) **não** é re-tentada — fica nas iniciais.

`ChatPanel.tsx` (header):
- Substituir/incluir `<AvatarImage src={conversation.remote_avatar_url} />` no avatar do header.

**4. Atualização da interface `Conversation`**
- Adicionar `remote_avatar_url: string | null` e `remote_avatar_fetched_at: string | null` em `src/services/conversationService.ts` e em todos os mapeamentos da RPC.

### Fora de escopo

- Refresh automático periódico (usuário pode mudar foto) — fica como "TTL de 7 dias quando o avatar é solicitado novamente".
- Storage local da imagem em bucket Supabase. As URLs da Evolution/Wuzapi são públicas e expiram; **se observarmos expiração**, fase 2: baixar e salvar em `chat-media/{tenant_id}/avatars/{conversation_id}.jpg`. Por ora referenciamos a URL direta.
- Foto de grupos (não aplicável — atendimento é 1:1).

### Validação

1. Conversa em instância **Evolution**: ao abrir a lista, dentro de ~2s os avatares com foto real aparecem; quem não tem foto no WhatsApp continua com iniciais.
2. Conversa em instância **Gupshup oficial (Meta)**: continua com iniciais, sem requests inúteis.
3. Header do `ChatPanel` exibe a foto sincronizada com a lista.
4. Recarregar a página: avatares aparecem instantaneamente (cache no banco).
5. Conversa nova (inbound): a primeira renderização mostra iniciais, em seguida a foto carrega.
6. Falha de rede no `whatsapp-fetch-avatar`: log em `webhook_logs`, UI mantém iniciais sem erro visível.
7. Aros de SLA continuam funcionando sobre o avatar com imagem.

