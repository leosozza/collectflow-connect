

# Correção: Payload de Áudio Gupshup

## Problema

Nosso código envia para Gupshup:
```json
{"type":"audio","url":"...","mimetype":"audio/ogg","filename":"audio.ogg"}
```

A documentação Gupshup diz que o payload correto é apenas:
```json
{"type":"audio","url":"https://example.com/audio.mp3"}
```

Os campos `mimetype` e `filename` não são aceitos pela API de áudio do Gupshup e provavelmente causam rejeição silenciosa.

## Correção

### `supabase/functions/_shared/whatsapp-sender.ts` — `sendGupshupMedia`

No bloco `gupType === "audio"` (linhas 198-209), simplificar para:

```typescript
} else if (gupType === "audio") {
  // Gupshup audio: only type + url (per official docs)
  msgPayload.url = media.mediaUrl;
}
```

Remover `mimetype`, `filename` e qualquer campo extra do payload de áudio Gupshup.

### Verificar os outros tipos também

Confirmar que `image` e `video` também seguem a doc Gupshup:
- **image**: `{type:"image", originalUrl:"...", previewUrl:"...", caption:"..."}` ✅ (já correto)
- **video**: `{type:"video", url:"...", caption:"..."}` ✅ (já correto)
- **document (file)**: `{type:"file", url:"...", filename:"..."}` ✅ (já correto)

Só o áudio está errado.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/whatsapp-sender.ts` | Remover `mimetype` e `filename` do payload áudio Gupshup |

