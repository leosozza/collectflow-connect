

# Correção: Áudio Gupshup conforme documentação oficial

## Diagnóstico

A documentação Gupshup confirma que o payload de áudio é apenas:
```json
{"type":"audio","url":"https://example.com/audio.mp3"}
```

O problema é duplo:
1. O browser grava em WebM/OGG, e o Gupshup rejeita esse formato no tipo `audio`
2. A conversão client-side para MP3 via `lamejs` é frágil e falha silenciosamente em alguns browsers

Você confirmou que enviar como **documento** (tipo `file`) funciona perfeitamente. A solução pragmática: no backend, mapear `audio` para `file` no Gupshup, eliminando a dependência de formato.

## Mudanças

### 1. `supabase/functions/_shared/whatsapp-sender.ts`

Na função `sendGupshupMedia`, alterar o mapeamento de `audio` para `file`:

```typescript
const typeMap: Record<string, string> = {
  image: "image",
  video: "video",
  audio: "file",      // audio como file — Gupshup aceita qualquer formato
  document: "file",
};
```

E no branch de `audio` (que agora cairá em `file`), garantir que `filename` seja incluído:
- Remover o bloco `else if (gupType === "audio")` separado
- O áudio passará pelo branch de `file` que já envia `url` + `filename`

### 2. `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`

Remover a conversão MP3 do `handleSendAudio` — não é mais necessária:
- Remover o bloco `if (isOfficial)` com `convertBlobToMp3`
- Manter apenas o upload do blob nativo do browser

### 3. Cleanup

- Remover `src/utils/audioConverter.ts` (não mais necessário)
- Remover dependência `lamejs` do `package.json`

### Resultado

- Áudio gravado sobe no formato nativo do browser (WebM/OGG)
- Gupshup recebe como `file` com `filename: "audio.ogg"` — entrega normalmente
- Fluxo não oficial (Evolution/WuzAPI) permanece inalterado
- Sem conversão client-side frágil

