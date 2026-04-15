

# Correção: Áudio inbound do Evolution não reproduz no RIVO

## Diagnóstico

Os logs mostram claramente o problema:
```
Parsed: type=audio, mime=audio/ogg; codecs=opus, hasMedia=false, fromMe=false
```

O campo `msgData.mediaUrl` vem **vazio** nos webhooks do Evolution para mensagens de áudio. O Evolution não envia a mídia diretamente no payload — ele fornece apenas a referência criptografada em `msg.audioMessage.url` (URL do CDN do WhatsApp, não acessível diretamente).

Para obter a mídia, é necessário chamar a **API do Evolution**: `POST /chat/getBase64FromMediaMessage/{instance}` passando a `message.key`. Isso retorna o conteúdo em base64.

## Solução

### 1. `supabase/functions/whatsapp-webhook/index.ts`

Quando `rawMediaUrl` estiver vazio e houver mensagem de mídia (audio, image, video, document, sticker):

1. Buscar a instância no banco (`instance_url`, `api_key`, `tenant_id`) em vez de apenas `tenant_id`
2. Chamar `POST {instance_url}/chat/getBase64FromMediaMessage/{instanceName}` com header `apikey` e body `{ message: msgData.key }`
3. O Evolution retorna `{ base64: "data:audio/ogg;base64,..." }` ou similar
4. Decodificar o base64, fazer upload direto ao Storage `chat-media`
5. Usar a URL pública resultante como `finalMediaUrl`

Pseudocódigo da mudança:
```typescript
// Após parsear o tipo de mídia, se rawMediaUrl vazio e é mídia:
if (!rawMediaUrl && messageType !== "text") {
  const { data: instRow } = await supabase
    .from("whatsapp_instances")
    .select("tenant_id, instance_url, api_key")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (instRow?.instance_url && instRow?.api_key) {
    // Chamar Evolution getBase64
    const b64Resp = await fetch(
      `${instRow.instance_url}/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: instRow.api_key },
        body: JSON.stringify({ message: msgData.key }),
      }
    );
    const b64Data = await b64Resp.json();
    // b64Data.base64 contém "data:audio/ogg;base64,XXXX..."
    // Decodificar, fazer upload ao Storage, definir finalMediaUrl
  }
}
```

### 2. Sem alterações em outros arquivos

- O frontend já renderiza `<audio>` com a `media_url` — se a URL for válida, vai funcionar
- O `media-persistence.ts` já lida com upload ao Storage
- Apenas o webhook precisa da lógica de fetch via API do Evolution

### Resultado esperado

- Áudio (e outras mídias) inbound do Evolution serão baixados via API `getBase64`, salvos no Storage e exibidos corretamente no RIVO
- Fallback: se a chamada ao Evolution falhar, loga o erro e persiste a mensagem sem mídia (comportamento atual)

