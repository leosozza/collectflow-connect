

# Correção: Áudio WebM rejeitado pela API Oficial (Gupshup)

## Causa raiz

O Chrome **não suporta** `audio/ogg;codecs=opus` no MediaRecorder. Mesmo que o `AudioRecorder.tsx` tente OGG primeiro, o Chrome sempre cai no fallback `audio/webm;codecs=opus`. O Gupshup rejeita WebM explicitamente.

O log confirma: `[gupshup] Sending audio with MIME audio/webm;codecs=opus — may be incompatible with WhatsApp`

## Solução

Converter o áudio WebM para OGG **no edge function** `send-chat-message`, antes de enviar ao Gupshup. WebM/Opus e OGG/Opus usam o mesmo codec (Opus) — a diferença é apenas o container. O processo:

1. Quando o provider for Gupshup e o MIME do áudio for `audio/webm`:
   - Baixar o arquivo do Storage
   - Re-fazer upload com extensão `.ogg` e content-type `audio/ogg;codecs=opus`
   - Usar a nova URL pública no envio ao Gupshup

2. Atualizar o MIME type passado ao sender para `audio/ogg;codecs=opus`

Isso funciona porque o codec interno (Opus) é idêntico — só muda o rótulo do container, e o WhatsApp/Gupshup aceita OGG/Opus.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/send-chat-message/index.ts` | Antes de chamar `sendByProvider`, detectar Gupshup + audio/webm → re-upload como OGG no Storage e usar a nova URL |
| `supabase/functions/_shared/whatsapp-sender.ts` | Remover o warning de WebM (não vai mais chegar WebM para Gupshup) |

## Detalhe técnico

No `send-chat-message/index.ts`, entre os passos 6 e 7 atuais:

```typescript
// Convert WebM audio to OGG label for official API compatibility
if (media && media.mediaType === "audio" && mediaMimeType?.includes("webm")) {
  const isOfficial = (instance.provider || conv.provider || "").toLowerCase() === "gupshup";
  if (isOfficial) {
    // Download from storage, re-upload as .ogg
    const resp = await fetch(mediaUrl);
    const audioBlob = await resp.arrayBuffer();
    const oggPath = mediaUrl.split("/chat-media/")[1].replace(/\.webm$/, ".ogg");
    await supabase.storage.from("chat-media").upload(oggPath, audioBlob, {
      contentType: "audio/ogg;codecs=opus",
      upsert: true,
    });
    const { data: oggUrl } = supabase.storage.from("chat-media").getPublicUrl(oggPath);
    media.mediaUrl = oggUrl.publicUrl;
    media.mimeType = "audio/ogg;codecs=opus";
  }
}
```

Nenhuma migração SQL necessária.

