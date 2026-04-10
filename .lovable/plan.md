

# Correção e Completude de Mídia + Transcrição no WhatsApp

## Resumo

O sistema já possui a base para mídia (webhooks, sender, UI), mas tem lacunas: o webhook não-oficial não persiste mídia no Storage, a separação oficial/não-oficial precisa ser reforçada, e transcrição de áudio não existe. Este plano corrige e completa em 5 fases sequenciais.

---

## Fase 1 — Recebimento de Mídia por Provider

### Webhook Não-Oficial (`whatsapp-webhook/index.ts`)
**Problema**: O webhook salva `msgData.mediaUrl` diretamente do provider (URL efêmera), sem baixar e persistir no Storage.

**Correção**:
- Após parsear a mídia (image/audio/video/document), buscar a instância para obter `tenant_id`
- Baixar a mídia da URL do provider (Evolution/WuzAPI fornecem `mediaUrl` no payload)
- Para Evolution: se `mediaUrl` não vier no payload, usar endpoint `GET /chat/getBase64FromMediaMessage/{instance}` para obter o arquivo
- Upload no bucket `chat-media` com path `{tenant_id}/{conv_id_ou_pending}/{uuid}.{ext}`
- Substituir `mediaUrl` pela URL pública do Storage antes de chamar o RPC
- Reutilizar a função `downloadAndUploadMedia` (já existe no gupshup-webhook) extraindo-a para `_shared/media-persistence.ts`

### Webhook Oficial (`gupshup-webhook/index.ts`)
**Problema**: Já faz download e upload de mídia, mas usa `"pending"` como conversationId no path. Funciona, mas é inconsistente.

**Correção**:
- Manter a lógica existente (já funcional)
- Apenas alinhar o path de storage para usar `tenant_id/pending/` (já faz isso)
- Garantir que `media_mime_type` seja extraído corretamente do header `content-type` do download (já faz)

### Novo arquivo: `_shared/media-persistence.ts`
Extrair a função `downloadAndUploadMedia` e `getExtFromMime` do `gupshup-webhook` para um módulo compartilhado, reutilizável por ambos os webhooks.

---

## Fase 2 — Envio de Mídia por Provider

### `send-chat-message/index.ts`
**Estado atual**: Já recebe `mediaUrl`, `mediaType`, `mediaMimeType`, `fileName` e delega ao `whatsapp-sender`. Funcional.

**Correção mínima**:
- Validar que `mediaType` é um dos valores válidos (`image`, `video`, `audio`, `document`)
- Garantir que `mimeType` seja passado ao sender (já faz)

### `_shared/whatsapp-sender.ts`
**Estado atual**: Já tem `sendEvolutionMedia`, `sendWuzapiMedia`, `sendGupshupMedia` separados por provider.

**Correções**:
- **Evolution**: endpoint `sendMedia` usa `mediatype` e `media` (URL). Para áudio, Evolution espera `mediatype: "audio"` e aceita URL. Verificar se `caption` não é enviado para áudio (WhatsApp não suporta caption em áudio). Remover caption de áudio.
- **WuzAPI**: Os campos são `Image`, `Audio`, `Video`, `Document` (PascalCase). Ajustar campo `Mimetype` para todos os tipos (não só document). Para áudio, não enviar Caption.
- **Gupshup**: Para `image` usa `originalUrl`/`previewUrl`; para `video`/`audio`/`file` usa `url`. Está correto. Remover caption de áudio.
- Adicionar `mimeType` no payload do Evolution quando enviando document (Evolution aceita `mimetype` no body).

---

## Fase 3 — Transcrição de Áudio

### Migração SQL
- Coluna `metadata` JSONB já existe em `chat_messages` (migration `20260409200614`). Usar `metadata.transcription` para guardar o texto.

### Nova Edge Function: `transcribe-audio/index.ts`
- Recebe `{ messageId, audioUrl }` 
- Baixa o áudio da URL
- Usa **Lovable AI Gateway** (`google/gemini-2.5-flash`) para transcrever — envia o áudio como base64 no prompt multimodal, pedindo transcrição em português
- Salva resultado em `chat_messages.metadata = { transcription: "texto..." }`
- Se falhar, salva `metadata = { transcription_error: "motivo" }` sem perder o áudio
- Não bloqueia ingestão — é chamada assincronamente

### Integração nos Webhooks
- Após ingestão bem-sucedida de áudio inbound, chamar `transcribe-audio` via `supabase.functions.invoke` (fire-and-forget, sem await bloqueante)
- Aplicar tanto no `whatsapp-webhook` quanto no `gupshup-webhook`

### UI (`ChatMessage.tsx`)
- No case `"audio"`: após o player, verificar `message.metadata?.transcription`
- Se existir, renderizar bloco discreto abaixo: ícone de transcrição + texto em fonte menor com label "Transcrição"
- Se existir `transcription_error`, mostrar indicador sutil de falha

---

## Fase 4 — Frontend de Mídia

### `ChatMessage.tsx`
- **Imagem**: Adicionar `onClick` para abrir em nova aba (ou lightbox simples via `window.open`)
- **Vídeo**: Já funcional com `<video controls>`
- **Áudio**: Já funcional com `<audio controls>`. Adicionar bloco de transcrição (Fase 3)
- **Documento**: Melhorar card — mostrar ícone de arquivo + nome + tamanho se disponível, em vez de apenas link com emoji

### `ChatInput.tsx`
- Já funcional. Sem mudanças necessárias.

### `conversationService.ts` → `sendMediaMessage`
- Já funcional. Sem mudanças necessárias.

### `WhatsAppChatLayout.tsx` → `handleSendMedia` / `handleSendAudio`
- Já funcional. Sem mudanças necessárias.

### Interface `ChatMessage` em `conversationService.ts`
- Adicionar campo opcional `metadata?: Record<string, any>` ao tipo `ChatMessage`
- Garantir que o `select()` do fetch de mensagens inclua `metadata`

---

## Fase 5 — Logs, Status e Robustez

### Logs de erro
- Em `_shared/media-persistence.ts`: logar erros de download/upload com `console.error` detalhado
- Em `transcribe-audio`: logar falhas de transcrição
- Nenhuma falha de mídia/transcrição deve quebrar a conversa

### Status de mídia
- Já funciona via `messages.update` nos webhooks (statusMap 2→sent, 3→delivered, 4→read)
- Gupshup já trata status (delivered, read, failed)
- Sem mudança necessária

### Provider message ID
- `send-chat-message` já persiste `providerMessageId` via RPC
- Webhooks já recebem `external_id`
- Sem mudança necessária

---

## Arquivos Afetados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `supabase/functions/_shared/media-persistence.ts` | **Novo** | Funções `downloadAndUploadMedia` e `getExtFromMime` extraídas |
| `supabase/functions/whatsapp-webhook/index.ts` | Editar | Adicionar persistência de mídia via `_shared/media-persistence.ts` |
| `supabase/functions/gupshup-webhook/index.ts` | Editar | Usar `_shared/media-persistence.ts` em vez de função inline |
| `supabase/functions/_shared/whatsapp-sender.ts` | Editar | Corrigir caption em áudio, adicionar mimeType em Evolution |
| `supabase/functions/transcribe-audio/index.ts` | **Novo** | Edge function de transcrição via Lovable AI |
| `src/components/contact-center/whatsapp/ChatMessage.tsx` | Editar | Transcrição, melhorar documento, click em imagem |
| `src/services/conversationService.ts` | Editar | Adicionar `metadata` ao tipo e ao select |

### Migração SQL
- Nenhuma necessária (coluna `metadata` JSONB já existe)

