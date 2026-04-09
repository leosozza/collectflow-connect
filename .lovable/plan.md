

# Corrigir endpoint de teste de conexão Gupshup

## Problema

O endpoint `GET /wa/app/{appName}` retorna 401 mesmo com credenciais válidas. O curl do usuário prova que a API Key funciona no endpoint de envio (`/wa/api/v1/template/msg`). O endpoint de "app info" provavelmente requer permissões de admin que a API Key de envio não possui.

## Correção

Trocar o endpoint de teste para `GET /sm/api/v2/wallet/balance`, que valida a API Key sem exigir permissões especiais. Esse endpoint retorna o saldo da conta e confirma que a chave é válida.

### Alteração em `supabase/functions/gupshup-proxy/index.ts`

Linha 41: trocar de:
```typescript
const response = await fetch(`https://api.gupshup.io/wa/app/${encodeURIComponent(appName)}`, {
```
Para:
```typescript
const response = await fetch("https://api.gupshup.io/sm/api/v2/wallet/balance", {
```

Isso valida que a API Key é autêntica. O `appName` será validado implicitamente quando o primeiro envio for feito.

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/gupshup-proxy/index.ts` | Trocar endpoint de `/wa/app/{appName}` para `/sm/api/v2/wallet/balance` |

