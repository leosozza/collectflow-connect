

## Diagnóstico — Renata Cibin do Nascimento não abre no WhatsApp

### O que está acontecendo

A cliente **existe** no sistema:
- CPF `06338297907` · Credor `TESS MODELS PRODUTOS FOTOGRAFICOS LTDA`
- Telefones: `41998824444` (hot) e `4133364843`
- Está corretamente em `client_profiles` e `client_phones` (E.164 `5541998824444`, `client_id` vinculado)

**Mas existe uma conversa órfã** em `conversations`:
- ID `470ad94a-2d73-44c1-962e-133d45fa3afc`
- `remote_phone = 5541998824444` (é o telefone da Renata)
- `remote_name = vazio`
- **`client_id = NULL`** ← raiz do problema
- Última mensagem: 13:22 hoje · Sem nenhuma `chat_message` registrada
- `assigned_to = NULL`, `status = open`

### Por que o botão "WhatsApp" não acessa a cliente

Quando a Maria Eduarda clica no botão de WhatsApp em `ClientDetailHeader`, o app navega para `/contact-center/whatsapp?phone=5541998824444`. O `WhatsAppChatLayout` então:

1. Procura uma conversa existente cujo telefone termine com os mesmos 8 dígitos.
2. **Encontra a conversa órfã `470ad94a`** (mesmo telefone) e a seleciona.
3. A conversa selecionada tem `client_id = NULL`, então o painel lateral não mostra os dados do cliente, agreements, histórico, etc. → "não consegue acessar a cliente".

Adicionalmente, como `assigned_to` está NULL e o status é `open` (não `waiting`), a Maria Eduarda pode nem enxergar a conversa nos seus filtros de inbox dependendo da regra de visibilidade (memory: inbox-filters / operational-flow-and-sla).

### Causa raiz

A conversa foi criada (provavelmente por um clique anterior no botão WhatsApp ou por evento da Evolution/Gupshup) **antes** do enriquecimento via `ingest_channel_event_v2`, ou a chamada de criação manual no `WhatsAppChatLayout` (linhas 197-221) **insere a conversa sem resolver `client_id`**:

```ts
// WhatsAppChatLayout.tsx — INSERT atual (sem resolução)
.insert({
  tenant_id, instance_id, remote_phone: normalizedParam,
  status: "open", last_message_at: ...
  // ❌ não chama resolve_client_by_phone, não preenche client_id, remote_name, channel_type, provider
})
```

Como não há mensagens nessa conversa (`chat_messages` = 0 linhas), o trigger/ingestão jamais rodou para enriquecê-la.

### Plano de correção

#### 1. Backfill da conversa atual (migração SQL pontual)
Vincular conversas órfãs existentes do tenant cujo `remote_phone` resolve a um cliente conhecido:

```sql
UPDATE conversations c
SET client_id = cp.client_id,
    remote_name = COALESCE(NULLIF(c.remote_name,''), prof.nome_completo)
FROM client_phones cp
LEFT JOIN client_profiles prof
  ON prof.tenant_id = cp.tenant_id AND prof.cpf = cp.cpf
WHERE c.client_id IS NULL
  AND c.tenant_id = cp.tenant_id
  AND right(regexp_replace(c.remote_phone,'\D','','g'),8) = cp.phone_last8;
```

Isso resolve a Renata imediatamente e qualquer outra conversa órfã.

#### 2. Correção do `WhatsAppChatLayout.tsx` — criar conversa já vinculada
Antes do `INSERT`, chamar a RPC `resolve_client_by_phone(tenant_id, phone)` que já existe no projeto (Fase 2 — multichannel) e usar o resultado para popular `client_id` e `remote_name`. Também preencher `channel_type='whatsapp'`, `provider` e `endpoint_id` da instância (alinhado com a arquitetura canônica multichannel).

```ts
const { data: resolved } = await supabase.rpc("resolve_client_by_phone", {
  p_tenant_id: tenantId, p_phone: normalizedParam,
});
const clientRow = resolved?.[0];

const { data } = await supabase.from("conversations").insert({
  tenant_id, instance_id: defaultInstance.id,
  remote_phone: normalizedParam,
  remote_name: clientRow?.nome_completo ?? null,
  client_id: clientRow?.client_id ?? null,
  channel_type: "whatsapp",
  status: "open",
  last_message_at: new Date().toISOString(),
}).select().single();
```

#### 3. Defesa adicional — re-resolver ao selecionar
No `useEffect` que carrega `clientInfo` (linha 240), se `selectedConv.client_id` estiver NULL e `remote_phone` existir, chamar `resolve_client_by_phone` e fazer um UPDATE silencioso na conversa para auto-vincular. Isso cura conversas legadas sem precisar de outra migração no futuro.

#### 4. Validação final
- Recarregar a página, clicar no botão WhatsApp na Renata como Maria Eduarda.
- Confirmar que abre a conversa `470ad94a` já com nome e dados da cliente no painel lateral, agreements visíveis e histórico carregado.

### Arquivos impactados
- Migração SQL (backfill único)
- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` (criação + auto-resolve ao selecionar)

### Sem impacto
- Nenhuma mudança em RLS, schema ou edge functions.
- A RPC `resolve_client_by_phone` já existe e é usada no engine de ingestão.

