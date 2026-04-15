

# Correção: Áudio outbound via Evolution chega como WebM (não reproduzível)

## Causa raiz

A conversão WebM→OGG no `send-chat-message/index.ts` só é aplicada quando `providerName === "gupshup"` (linha 148). Para Evolution e WuzAPI, o áudio WebM é enviado diretamente — o WhatsApp não reproduz WebM inline, então o destinatário não recebe nada audível.

## Solução

Remover a restrição de provider no bloco de remux. A conversão WebM→OGG deve ocorrer para **todos os providers** (Gupshup, Evolution, WuzAPI), pois o WhatsApp universalmente exige OGG/Opus para áudio inline.

### Alteração: `supabase/functions/send-chat-message/index.ts`

Linha 148, mudar de:
```typescript
if (isWebm && providerName === "gupshup") {
```
Para:
```typescript
if (isWebm) {
```

Isso faz o remux WebM→OGG rodar para qualquer provider quando o áudio é WebM. O fallback para `document` já existe caso o remux falhe.

### Arquivos
- `supabase/functions/send-chat-message/index.ts` — uma linha alterada

