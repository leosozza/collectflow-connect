

# Correção: Áudio chegando como documento não-reproduzível no WhatsApp

## Problema

O áudio gravado no browser é WebM/Opus. Ao enviar via Gupshup como `file`, chega como documento `.webm` — o destinatário não consegue ouvir inline. A API do Gupshup aceita `audio` apenas nos formatos OGG, MP3, AAC, AMR.

## Causa raiz

WebM e OGG são apenas containers diferentes para o mesmo codec Opus. O browser (Chrome) grava em WebM, mas o Gupshup precisa de OGG para entregar como áudio reproduzível.

## Solução: Remux WebM→OGG no servidor

Como ambos os formatos usam o codec Opus, a conversão é apenas troca de container (sem re-encoding). Isso é feito com parsing leve em TypeScript puro, sem dependências externas.

### Mudanças

#### 1. `supabase/functions/_shared/webm-to-ogg.ts` (novo)
Remuxer puro TypeScript:
- Parseia o container WebM/Matroska para extrair pacotes Opus brutos
- Empacota os pacotes em container OGG com headers Opus corretos (OpusHead + OpusTags)
- Retorna `Uint8Array` do arquivo OGG
- ~150 linhas, zero dependências externas

#### 2. `supabase/functions/send-chat-message/index.ts`
No bloco `6b` (após detectar audio WebM + provider Gupshup):
- Fetch do arquivo WebM do storage
- Chamar `remuxWebmToOgg()` para converter
- Upload do OGG convertido ao mesmo bucket `chat-media` com extensão `.ogg`
- Atualizar `media.mediaUrl`, `media.mimeType`, `media.fileName`, `persistMediaUrl` e `persistMimeType` para apontar ao OGG
- Log da conversão

#### 3. `supabase/functions/_shared/whatsapp-sender.ts`
Reverter mapeamento de `audio` de `file` para `audio`:
```typescript
const typeMap: Record<string, string> = {
  image: "image",
  video: "video",
  audio: "audio",    // ← volta para audio (agora será OGG válido)
  document: "file",
};
```
E adicionar branch para `audio` no payload Gupshup:
```typescript
} else if (gupType === "audio") {
  msgPayload.url = media.mediaUrl;
}
```

### Resultado esperado
- Áudio gravado em WebM → convertido para OGG no servidor → enviado como `audio` no Gupshup
- Destinatário recebe áudio reproduzível inline no WhatsApp
- Frontend continua exibindo o player normalmente (OGG é compatível com `<audio>`)
- Providers não-oficiais (Evolution/WuzAPI) não são afetados
- Transcrição continua funcionando (Opus codec é o mesmo)

