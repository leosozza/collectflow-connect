
## Objetivo

Entregar duas melhorias no Contact Center → WhatsApp **sem alterar o fluxo de envio/recebimento atual** (mensagens, áudios, mídia, status, replies continuam intactos):

1. **Colar imagem (Ctrl+V)** direto no campo de texto do chat → envia como anexo, igual ao botão "clipe".
2. **Reações** (👍 ❤️ 😂 etc.) que o cliente envia em uma mensagem → exibir o emoji na própria bolha da mensagem reagida, no estilo WhatsApp Web.

---

## 1) Confirmação na Evolution API v2

Após revisar a documentação (`doc.evolution-api.com/v2`) e o payload real que já chega no nosso webhook:

- **Reações são suportadas.** A Evolution dispara o evento `messages.upsert` com `data.message.reactionMessage`:
  ```json
  {
    "event": "messages.upsert",
    "data": {
      "key": { "id": "<id-da-reação>", "fromMe": false, "remoteJid": "..." },
      "message": {
        "reactionMessage": {
          "key": { "id": "<id-da-mensagem-original>", "fromMe": true },
          "text": "👍",          // emoji (ou "" para remoção)
          "senderTimestampMs": 1730000000000
        }
      }
    }
  }
  ```
  Hoje nosso `whatsapp-webhook` **ignora silenciosamente** esse subtipo (cai fora dos `if/else if` de tipo e grava como texto vazio). É só o que precisamos tratar — nenhuma config nova na Evolution.

- **Colar imagem** é puramente front-end (clipboard do browser). Reaproveita o mesmo `onSendMedia(file)` que o botão "clipe" já usa → vai pelo `send-chat-message` → `sendMedia` da Evolution. Sem mudança no backend.

---

## 2) Mudanças — Reações (👍❤️…)

### 2.1 Banco — nova coluna `reactions` em `chat_messages`
Migration:
- `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '[]'::jsonb;`
- Index GIN opcional para futuras buscas.
- Formato de cada item:
  ```json
  { "emoji": "👍", "from": "remote" | "me", "actor_jid": "55...@s.whatsapp.net", "ts": 1730000000000 }
  ```
- Realtime: `chat_messages` já está na publicação `supabase_realtime`, então o front recebe o update sem trabalho extra.

### 2.2 `supabase/functions/whatsapp-webhook/index.ts`
Antes do bloco que parseia `messageType`, adicionar:

```ts
// ===== Reaction message — não cria mensagem nova, atualiza a mensagem reagida =====
const reaction = msg?.reactionMessage;
if (reaction?.key?.id) {
  const targetExternalId = reaction.key.id;
  const emoji = (reaction.text ?? "").toString();
  const actorJid = msgData.key?.participant || remoteJid;

  // Localiza a mensagem original no tenant
  const { data: instReact } = await supabase
    .from("whatsapp_instances")
    .select("tenant_id")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (instReact?.tenant_id) {
    const { data: target } = await supabase
      .from("chat_messages")
      .select("id, reactions")
      .eq("tenant_id", instReact.tenant_id)
      .or(`external_id.eq.${targetExternalId},provider_message_id.eq.${targetExternalId}`)
      .limit(1)
      .maybeSingle();

    if (target) {
      const list = Array.isArray(target.reactions) ? [...target.reactions] : [];
      // Mantém apenas a reação mais recente por ator (WhatsApp permite só 1 por contato).
      const filtered = list.filter((r: any) => r.actor_jid !== actorJid);
      if (emoji) {
        filtered.push({
          emoji,
          from: fromMe ? "me" : "remote",
          actor_jid: actorJid,
          ts: reaction.senderTimestampMs ?? Date.now(),
        });
      }
      await supabase.from("chat_messages").update({ reactions: filtered }).eq("id", target.id);
    }
  }
  return new Response(JSON.stringify({ ok: true, reaction: targetExternalId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

Pontos críticos preservados:
- Não chama `ingest_channel_event_v2` → **não cria mensagem fantasma** na timeline.
- Não toca em `revoke`, status updates, áudio, mídia, replies — todos os branches já existentes ficam idênticos.
- Falha de lookup nunca quebra o webhook (retorna `ok: true`).

### 2.3 Front — `ChatMessage.tsx`
- Ler `message.reactions` (vem direto via realtime de `chat_messages`).
- Renderizar um *badge* sobreposto no canto inferior da bolha:
  ```tsx
  {reactions?.length > 0 && (
    <div className="absolute -bottom-2 right-2 bg-card border border-border/60 rounded-full px-1.5 py-0.5 text-xs shadow flex items-center gap-0.5">
      {Array.from(new Set(reactions.map(r => r.emoji))).slice(0,3).map(e => <span key={e}>{e}</span>)}
      {reactions.length > 1 && <span className="text-[10px] text-muted-foreground">{reactions.length}</span>}
    </div>
  );
  ```
- Tipagem em `ChatMessage` (`services/conversationService.ts`): adicionar `reactions?: Array<{emoji:string; from:"me"|"remote"; actor_jid:string; ts:number}>`.

> **Escopo desta entrega:** apenas **exibir** reações recebidas (era o pedido). Enviar reação a partir do Rivo fica para uma fase 2.

---

## 3) Mudanças — Colar imagem (Ctrl+V)

Apenas `src/components/contact-center/whatsapp/ChatInput.tsx`:

```tsx
const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of Array.from(items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        // Renomeia para algo legível
        const named = new File([file], `colado-${Date.now()}.${(file.type.split("/")[1] || "png")}`, { type: file.type });
        onSendMedia(named);
        return;
      }
    }
  }
};
```
- Plugar via `onPaste={handlePaste}` no `<Textarea>`.
- Não interfere em colar texto normal (só consome o evento se houver arquivo de imagem).
- Reusa exatamente o mesmo caminho do botão de clipe → zero risco no envio.

(Opcional, fase 2 trivial: aceitar `video/*` e `application/pdf` colados também.)

---

## 4) Plano de validação (sem perder mensagem alguma)

1. **Migration aplicada** com `DEFAULT '[]'::jsonb` → registros antigos continuam válidos, nada a *backfill*.
2. **Smoke test do webhook** (dev):
   - Mensagem texto normal → ainda cai em `ingest_channel_event_v2`.
   - Mídia (imagem/áudio) → caminho de upload inalterado.
   - REVOKE → marca `deleted_for_recipient_at` igual antes.
   - Reação nova → grava em `reactions`, **não** cria nova `chat_messages`.
   - Reação removida (`text:""`) → remove do array.
   - `messages.update` (status sent/delivered/read) → inalterado.
3. **Front**:
   - Colar print → vai como anexo, mensagem aparece otimista, status atualiza normal.
   - Reação do cliente → badge aparece em até ~1s via realtime; remoção some o badge.

## 5) Itens de risco e mitigação

| Risco | Mitigação |
|---|---|
| Reação chegar antes da mensagem original ser persistida | Lookup por `external_id`/`provider_message_id`; se não achar, simplesmente não aplica (não cria fantasma). Webhook do WhatsApp reentrega quase nada de reações antigas, então a perda é cosmética e raríssima. |
| Operador colar texto formatado e esperar comportamento de imagem | `handlePaste` só intercepta itens `kind === "file"`; texto continua normal. |
| Coluna `reactions` quebrar `select('*')` antigo | jsonb com default `[]` e nullable false → compatível. Tipos do Supabase serão regenerados automaticamente. |
| Reação enviada por nós mesmos (`fromMe`) duplicar | Filtra por `actor_jid` (apenas a reação mais recente por contato fica). |

## 6) Arquivos tocados

- `supabase/migrations/<novo>.sql` — coluna `reactions`.
- `supabase/functions/whatsapp-webhook/index.ts` — branch novo de `reactionMessage`.
- `src/components/contact-center/whatsapp/ChatInput.tsx` — `onPaste`.
- `src/components/contact-center/whatsapp/ChatMessage.tsx` — badge de reações.
- `src/services/conversationService.ts` — tipagem `reactions`.

Nada mais é alterado. Envio de mensagens, áudios, mídia, replies, transcrição, campanhas e status (sent/delivered/read) seguem exatamente como hoje.
