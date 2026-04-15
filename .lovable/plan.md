

# Correção: Áudio outbound via Evolution — endpoint errado

## Diagnóstico

Os logs mostram que o áudio é enviado com sucesso (HTTP 200, providerMessageId retornado), mas **não chega ao destinatário**. Isso acontece porque estamos usando o endpoint genérico `/message/sendMedia/` com `mediatype: "audio"`, que não funciona corretamente para áudio no WhatsApp.

A API do Evolution tem um **endpoint dedicado para áudio**: `POST /message/sendWhatsAppAudio/{instance}` com payload:
```json
{
  "number": "5511999999999",
  "audio": "https://url-do-audio.ogg"
}
```

O campo é `audio` (não `media`), e o endpoint é `sendWhatsAppAudio` (não `sendMedia`). Este endpoint converte e envia como voice note (PTT), que é o formato correto do WhatsApp.

## Solução

### Alteração: `supabase/functions/_shared/whatsapp-sender.ts`

Na função `sendEvolutionMedia`, quando `media.mediaType === "audio"`, usar o endpoint dedicado:

```typescript
// Dentro de sendEvolutionMedia, ANTES do payload genérico:
if (media.mediaType === "audio") {
  const audioPayload = {
    number: phone,
    audio: media.mediaUrl,
  };
  
  const resp = await fetch(
    `${instanceUrl}/message/sendWhatsAppAudio/${inst.instance_name}`,
    {
      method: "POST",
      headers: { apikey: instanceKey, "Content-Type": "application/json" },
      body: JSON.stringify(audioPayload),
    }
  );
  const result = await resp.json();
  return { ok: resp.ok, result, providerMessageId: result?.key?.id || null, provider };
}

// ... resto do sendMedia para image/video/document continua igual
```

### Arquivos
- `supabase/functions/_shared/whatsapp-sender.ts` — adicionar branch para audio no `sendEvolutionMedia`

### Resultado esperado
- Áudio enviado via Evolution usa `/message/sendWhatsAppAudio/` com campo `audio`
- Destinatário recebe voice note reproduzível inline
- Imagens, vídeos e documentos continuam usando `/message/sendMedia/` normalmente

