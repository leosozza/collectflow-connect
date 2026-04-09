

# Plano de Implementação — Paridade Gupshup (ThothAI → Rivo)

## Resumo

Implementar 4 melhorias na integração Gupshup: coluna `metadata` para contexto de botões, persistência automática de mídia no Storage, correção do roteamento webhook, e padronização do envio de mídia.

## Respostas às perguntas abertas

- **Transcrição**: Sim, a coluna `metadata` (jsonb) já comportará transcrições futuras sem nova migração.
- **Handoff IA vs Humano**: Não será implementado agora; pode ser adicionado depois via flag na conversa.

---

## 1. Migração de Banco de Dados

**Arquivo**: Nova migração SQL

```sql
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
```

- `provider_message_id` já existe (adicionado na migração `20260407174146`), não precisa re-criar.
- `metadata` servirá para: contexto de botões simulados, transcrições futuras, dados extras do provider.

---

## 2. Edge Function `gupshup-webhook/index.ts` — Reescrever

Mudanças principais:

- **Separar `message` vs `message-event`**: Usar `if/else if` em vez de dois `if` independentes, evitando que `message-event` caia em ambos os blocos.
- **Cascata de URLs de mídia**: Buscar URL em `payload.payload.url`, `payload.payload.originalUrl`, `payload.payload.payload.url` recursivamente (padrão ThothAI).
- **`downloadAndUploadMedia()`**: Nova função que baixa o arquivo da Gupshup e faz upload para o bucket `chat-media` do Storage, retornando a URL pública persistida. Inclui timeout de 15s.
- **Botões simulados**: Quando `msgType === "text"` e o conteúdo é "1", "2", "3" etc., buscar a última mensagem outbound com `metadata.buttons` na conversa para mapear a resposta numérica ao label do botão. Salvar contexto em `metadata` da mensagem.
- **Mime type**: Extrair mime type do header `Content-Type` ao baixar a mídia.

---

## 3. `_shared/whatsapp-sender.ts` — Padronizar envio de mídia

- **Gupshup media**: Garantir `filename` e `mimetype` nos payloads de document/audio/video.
- **Vídeo**: Adicionar `caption` no payload.
- **Áudio**: Adicionar `mimetype: "audio/ogg"` por padrão.
- **Document**: Incluir `mimetype` dinâmico a partir do `mimeType` passado.

Snippet da mudança no `sendGupshupMedia`:
```typescript
} else if (gupType === "video") {
  msgPayload.url = media.mediaUrl;
  msgPayload.caption = media.caption || "";
  msgPayload.mimetype = media.mimeType || "video/mp4"; // NOVO
} else if (gupType === "audio") {
  msgPayload.url = media.mediaUrl;
  msgPayload.mimetype = media.mimeType || "audio/ogg"; // NOVO
} else {
  msgPayload.url = media.mediaUrl;
  msgPayload.filename = media.fileName || "file";
  msgPayload.mimetype = media.mimeType || "application/octet-stream"; // NOVO
}
```

---

## 4. Frontend `ChatMessage.tsx` — Ajuste de renderização

- Garantir que `<audio>` e `<video>` funcionem com URLs do Storage (já funciona, pois o bucket `chat-media` é público).
- Nenhuma mudança estrutural necessária no `ChatPanel.tsx` — já renderiza corretamente via `ChatMessageBubble`.

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| Nova migração SQL | Adicionar coluna `metadata` jsonb |
| `supabase/functions/gupshup-webhook/index.ts` | Reescrever com cascata de URLs, persistência de mídia, botões simulados, fix do roteamento |
| `supabase/functions/_shared/whatsapp-sender.ts` | Padronizar `mimetype`/`filename` no envio Gupshup |

---

## Verificação

- Deploy das edge functions e teste via `curl_edge_functions` com payloads simulados de texto, imagem e status.
- Verificar nos logs (`webhook_logs`) se mídia é persistida corretamente.

