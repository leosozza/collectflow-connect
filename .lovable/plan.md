

# Correção Completa de Mídia e Transcrição — WhatsApp

## Diagnóstico do Estado Atual

Após análise detalhada de todos os arquivos envolvidos, o sistema já tem uma base sólida. Os problemas reais são pontuais:

### O que já funciona:
- `media-persistence.ts` — download + upload para bucket `chat-media` ✅
- `whatsapp-webhook` — parse de image/audio/video/document + persistência + transcrição ✅
- `gupshup-webhook` — parse + persistência + transcrição + mapeamento `file→document` ✅
- `whatsapp-sender.ts` — envio separado por provider (Evolution, WuzAPI, Gupshup) ✅
- `send-chat-message` — conversão WebM→OGG para Gupshup ✅
- `transcribe-audio` — pipeline com Gemini + metadata ✅
- `ChatMessage.tsx` — renderização de image/audio/video/document/sticker + transcrição ✅
- `ChatInput.tsx` — upload de arquivos + gravação de áudio ✅

### Problemas identificados:

1. **Webhook não-oficial**: `conversationId` é passado como `"pending"` na persistência de mídia, não como o ID real da conversa (cosmético no path do storage, mas inconsistente)
2. **Gupshup webhook**: mesmo problema — `"pending"` no path
3. **Gupshup webhook**: `_endpoint_id` não é passado quando usa `ingest_channel_event` (sem instanceName), pode falhar a associação
4. **send-chat-message**: persiste `mediaUrl` original do frontend (URL do bucket) mas se houve conversão WebM→OGG, o `media_url` salvo no RPC ainda aponta para a URL original WebM, não a OGG convertida
5. **Gupshup media sender**: campo `audio.url` pode estar incorreto — Gupshup espera `url` para áudio mas com filename obrigatório
6. **Gupshup media sender**: imagem usa `originalUrl` mas não `caption` de forma consistente
7. **Transcrição**: não há tratamento para áudios outbound gravados pelo operador
8. **Frontend**: `handleSendMedia` determina mediaType pelo MIME do browser, mas não valida se o tipo é compatível antes de enviar
9. **Logs de erro**: falhas de envio de mídia não são logadas na tabela `webhook_logs`

---

## Plano de Execução (5 Fases)

### Fase 1 — Recebimento de Mídia por Provider

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**
- Usar o `conversation_id` retornado pelo RPC para atualizar o path no storage (ou aceitar "pending" como path válido — é funcional)
- Adicionar log estruturado com `[provider=unofficial]` em cada mídia recebida
- Garantir que `media_mime_type` do provider não seja perdido quando `contentType` do download difere

**Arquivo: `supabase/functions/gupshup-webhook/index.ts`**
- Adicionar extração de `filename` do payload Gupshup (`msgPayload.payload?.name` ou `msgPayload.payload?.filename`)
- Salvar `filename` no `_content` quando for documento (já faz parcialmente)
- Adicionar log com `[provider=gupshup]` em cada mídia
- Resolver `_endpoint_id`: buscar instância Gupshup do tenant para passar ao RPC

**Arquivo: `supabase/functions/_shared/media-persistence.ts`**
- Adicionar suporte a `audio/webm` no mapa de extensões
- Adicionar `audio/amr` (formato comum em WhatsApp oficial antigo)
- Logging melhorado com tamanho do arquivo e tempo de download

### Fase 2 — Envio de Mídia por Provider

**Arquivo: `supabase/functions/send-chat-message/index.ts`**
- Corrigir: após conversão WebM→OGG, usar `media.mediaUrl` (convertido) no RPC de persistência, não a URL original
- Adicionar validação de MIME real para áudio oficial: se o MIME não for `audio/ogg`, `audio/mpeg` ou `audio/mp4`, converter
- Adicionar log estruturado: provider, mediaType, mimeType, resultado do envio
- Persistir `provider_message_id` consistentemente para mídia

**Arquivo: `supabase/functions/_shared/whatsapp-sender.ts`**
- **Gupshup audio**: garantir que `filename` seja sempre enviado (ex: `audio.ogg`)
- **Gupshup document**: adicionar `caption` como campo separado se houver
- **Evolution**: validar que `sendMedia` aceita o campo `mimetype` para todos os tipos (não só document/audio)
- Adicionar log de request/response por provider para debug

### Fase 3 — Transcrição de Áudio

**Arquivo: `supabase/functions/transcribe-audio/index.ts`**
- Já funcional — apenas melhorar o mapeamento de formato: `ogg` → `wav` fallback (Gemini aceita)
- Adicionar log de duração da transcrição

**Arquivos: `whatsapp-webhook` e `gupshup-webhook`**
- Já disparam transcrição para áudio inbound ✅
- Adicionar disparo para áudio outbound (gravado pelo operador) — fire-and-forget também

### Fase 4 — Frontend de Mídia

**Arquivo: `src/components/contact-center/whatsapp/ChatMessage.tsx`**
- Já renderiza todos os tipos corretamente ✅
- Melhorar: mostrar caption separado do filename para documentos
- Melhorar: adicionar ícone de download explícito no card de documento

**Arquivo: `src/components/contact-center/whatsapp/ChatInput.tsx`**
- Já funcional ✅ — sem alterações necessárias

**Arquivo: `src/services/conversationService.ts`**
- Já funcional ✅ — sem alterações necessárias

### Fase 5 — Logs, Status e Robustez

**Arquivo: `supabase/functions/send-chat-message/index.ts`**
- Adicionar log estruturado de falhas no `webhook_logs`
- Quando envio falha, persistir mensagem com `status: "failed"` em vez de retornar erro 502 sem registro

**Arquivo: `supabase/functions/_shared/whatsapp-sender.ts`**
- Retornar informações de erro mais detalhadas (HTTP status, body do provider)

---

## Arquivos Afetados

| Ação | Arquivo |
|---|---|
| Editar | `supabase/functions/_shared/media-persistence.ts` |
| Editar | `supabase/functions/_shared/whatsapp-sender.ts` |
| Editar | `supabase/functions/whatsapp-webhook/index.ts` |
| Editar | `supabase/functions/gupshup-webhook/index.ts` |
| Editar | `supabase/functions/send-chat-message/index.ts` |
| Editar | `supabase/functions/transcribe-audio/index.ts` |
| Editar | `src/components/contact-center/whatsapp/ChatMessage.tsx` |

## O que NÃO será alterado
- Campanhas, automação, fila waiting/open, reply, filtros, /atendimento
- ChatInput, ConversationService, WhatsAppChatLayout (já funcionais)
- Nenhuma migração de banco necessária (metadata JSONB já suporta tudo)

