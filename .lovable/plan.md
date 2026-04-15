

# Correção: Áudio inbound Evolution não reproduz — credenciais do webhook

## Causa raiz

A tabela `whatsapp_instances` tem `instance_url` e `api_key` **vazios** para instâncias não-oficiais. O código de fetch via `getBase64` exige esses campos e é silenciosamente ignorado — o áudio é salvo sem media_url, resultando em player 0:00/0:00.

Porém, o Evolution envia `server_url` e `apikey` diretamente no payload de cada webhook. Basta usar esses valores como fallback.

## Solução

### 1. `supabase/functions/whatsapp-webhook/index.ts`

No bloco que busca mídia via getBase64 (linha ~121), usar credenciais do payload do webhook como fallback:

```typescript
// Resolve Evolution API credentials: DB first, webhook payload as fallback
const evoUrl = instRow?.instance_url || body.server_url || "";
const evoKey = instRow?.api_key || body.apikey || "";

if (!rawMediaUrl && messageType !== "text" && evoUrl && evoKey) {
  // fetch via getBase64 using evoUrl and evoKey instead of instRow fields
  const b64Resp = await fetch(
    `${evoUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoKey },
      body: JSON.stringify({ message: { key: msgData.key } }),
    }
  );
  // ... rest unchanged
}
```

### 2. Opcionalmente, persistir credenciais no DB

Se `instRow` não tem `instance_url`/`api_key` mas o webhook tem, atualizar a row para futuras chamadas. Isso é um bonus, não bloqueante.

### Resultado esperado
- Áudio inbound do Evolution será baixado via `getBase64` usando credenciais do próprio webhook
- Player no RIVO mostrará duração real e permitirá reprodução/download
- Sem alterações no frontend — o `<audio>` já funciona com URL válida

