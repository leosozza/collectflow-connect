
# Análise e correção focada em áudio + PDF no WhatsApp

## Diagnóstico confirmado
- O problema do áudio na API oficial está no envio, não no gravador:
  - `AudioRecorder.tsx` já tenta gravar em `audio/ogg;codecs=opus`.
  - `WhatsAppChatLayout.tsx` desfaz isso e recria sempre o arquivo como `.webm` com `type: "audio/webm;codecs=opus"`.
- Evidência já encontrada:
  - na conversa oficial `2fbe85d2-0a2d-4205-a837-a93566006145`, os áudios outbound recentes foram salvos com `media_mime_type = audio/webm;codecs=opus` e `status = failed`.
- O PDF inbound chegou corretamente:
  - `message_type = document`
  - `media_mime_type = application/pdf`
  - `media_url` preenchida.
- O bloqueio do PDF acontece na abertura:
  - hoje `ChatMessage.tsx` abre o documento com link direto `target="_blank"` para a URL pública;
  - o anexo mostra `ERR_BLOCKED_BY_CLIENT`, então a mensagem chegou, mas a navegação direta para o arquivo está sendo bloqueada no navegador.

## O que será corrigido
### 1) Áudio outbound na API oficial
- Em `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`:
  - parar de forçar `.webm`;
  - usar o `blob.type` real vindo do `AudioRecorder`;
  - definir nome/extensão conforme o MIME real (`.ogg`, `.mp3`, `.m4a`, fallback `.webm`).
- Manter a separação correta oficial vs não oficial:
  - oficial: aceitar só MIME compatível;
  - não oficial: manter o fluxo atual.
- Em `supabase/functions/_shared/whatsapp-sender.ts`:
  - adicionar validação defensiva para provider oficial;
  - se entrar `audio/webm`, retornar erro claro e rastreável em vez de falha silenciosa.

### 2) Abertura de PDF/documento no chat
- Em `src/components/contact-center/whatsapp/ChatMessage.tsx`:
  - substituir a abertura direta por um handler de download/abertura via `Blob` + `objectURL`;
  - manter fallback caso a primeira tentativa falhe.
- Isso resolve o uso no chat sem depender de abrir a URL pública crua em nova aba.

### 3) Consistência do histórico
- Revisar o fluxo de documento outbound (`handleSendMedia` → `sendMediaMessage` → `send-chat-message`) porque há mensagens recentes salvas com `media_url = null`.
- Se a perda estiver nesse fluxo, corrigir apenas esse ponto para que documentos enviados continuem abríveis no histórico.

## Arquivos envolvidos
- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`
- `src/components/contact-center/whatsapp/ChatMessage.tsx`
- `supabase/functions/_shared/whatsapp-sender.ts`
- Possivelmente `supabase/functions/send-chat-message/index.ts` se a revisão do item 3 confirmar a perda de `media_url`

## Detalhes técnicos
- Reaproveitar a distinção já existente por `provider_category` / `isOfficialApi`; não precisa mexer em campanhas, automação, permissões, filas, SLA, filtros, reply ou `/atendimento`.
- O gravador com pausar/retomar/preview já está no caminho certo; o ajuste crítico é preservar o formato real até o envio.
- O PDF não precisa ser reintegrado no webhook; ele já está armazenado. O problema atual é somente a forma de abrir no frontend.

## Resultado esperado
- áudio enviado na API oficial com formato compatível e chegando no destino;
- PDF/documento abrindo pelo chat;
- histórico de mídia consistente para reabertura posterior;
- sem regressão no restante do módulo WhatsApp.
