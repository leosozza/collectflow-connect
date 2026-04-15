

# Correção: Áudio na API Oficial + Playback na Não-Oficial

## Problema 1 — Áudio não chega no destinatário (Oficial/Gupshup)

A "conversão" WebM→OGG no `send-chat-message` é falsa — apenas re-uploada os mesmos bytes WebM com extensão `.ogg` e content-type `audio/ogg`. O Gupshup valida o conteúdo real do arquivo e rejeita/descarta silenciosamente porque os bytes são WebM, não OGG.

**Solução**: O `AudioRecorder.tsx` (linha 56) já tenta gravar em `audio/ogg;codecs=opus` primeiro. Se o Chrome suportar (e ele suporta), o arquivo já sai como OGG real. O problema é que o backend tenta "converter" de qualquer forma quando o MIME contém "webm". A correção:

1. **Frontend (`AudioRecorder.tsx`)**: Já está correto — prioriza OGG
2. **Backend (`send-chat-message`)**: Expandir a lógica de conversão para detectar se o arquivo já é OGG (não precisa converter) e, quando for realmente WebM, usar a Gupshup com o MIME correto `audio/webm` em vez de fingir que é OGG. Alternativamente, enviar como `document` (file) quando não for possível converter.
3. **Gupshup sender**: Ajustar para enviar áudio WebM como `file` (documento) com nome `audio.webm` quando o formato não for aceito nativamente, OU aceitar que Gupshup suporta `audio/ogg` (que é o que o Chrome grava quando suportado).

**Correção principal**: Remover a conversão falsa. Se o MIME já é `audio/ogg`, enviar direto. Se for `audio/webm`, NÃO fingir que é OGG — em vez disso, converter no frontend garantindo que o MediaRecorder use OGG, ou enviar como documento.

## Problema 2 — Áudio não toca (Não-Oficial)

O `<audio>` usa `<source type="...">` que faz o browser pular a source se não reconhecer o tipo. Alguns MIMEs salvos (como `audio/ogg; codecs=opus`) podem causar problemas.

**Correção**: Usar `src` diretamente no `<audio>` sem `<source type>`, que é mais tolerante.

## Mudanças

### 1. `ChatMessage.tsx` — Playback de áudio
- Trocar `<source src="..." type="...">` por `<audio src="..." controls>` direto
- Remove a dependência do MIME type para playback

### 2. `send-chat-message/index.ts` — Remover conversão falsa
- Se o MIME do áudio já é `audio/ogg` (ou variantes com codecs=opus), enviar direto sem "converter"
- Se for `audio/webm` e provider é Gupshup: tentar baixar e re-upload como OGG apenas se o conteúdo for realmente convertível, ou melhor — forçar o frontend a gravar em OGG
- Log claro do MIME real antes de enviar

### 3. `AudioRecorder.tsx` — Garantir OGG no Chrome
- Já prioriza OGG, mas adicionar fallback logging para saber qual formato foi escolhido
- Forçar `audio/ogg;codecs=opus` como única opção antes de WebM

### 4. `whatsapp-sender.ts` (Gupshup)
- Quando MIME for `audio/ogg;codecs=opus`, enviar sem `codecs=opus` no campo mimetype (Gupshup pode não aceitar o sufixo)
- Normalizar para `audio/ogg` no payload

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/contact-center/whatsapp/ChatMessage.tsx` | `<audio src>` direto |
| `supabase/functions/send-chat-message/index.ts` | Remover conversão falsa WebM→OGG |
| `supabase/functions/_shared/whatsapp-sender.ts` | Normalizar MIME `audio/ogg;codecs=opus` → `audio/ogg` |
| `src/components/contact-center/whatsapp/AudioRecorder.tsx` | Log do formato escolhido |

