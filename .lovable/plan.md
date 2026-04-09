

# Corrigir erro 405 no teste de conexão Gupshup

## Problema

O endpoint `https://api.gupshup.io/sm/api/v1/template/msg` está retornando **HTTP 405 (Method Not Allowed)** para requisições GET. Essa API provavelmente espera POST ou a URL correta para listar templates inclui o `appName` no path.

## Correção

### `supabase/functions/gupshup-proxy/index.ts`

Trocar o endpoint de validação para um que aceite GET e valide as credenciais:

```typescript
// DE:
const response = await fetch("https://api.gupshup.io/sm/api/v1/template/msg", {
  method: "GET",
  headers: {
    "apiKey": apiKey,
    "Content-Type": "application/x-www-form-urlencoded",
  },
});

// PARA:
const response = await fetch(`https://api.gupshup.io/wa/app/${encodeURIComponent(appName)}`, {
  method: "GET",
  headers: {
    "apiKey": apiKey,
  },
});
```

Este endpoint (`/wa/app/{appName}`) retorna informações do app e valida tanto a API Key quanto o App Name em uma única chamada. Se as credenciais forem inválidas, a Gupshup retorna erro estruturado. O restante do código (parse de texto, tratamento de erros) permanece igual.

Após a alteração, re-deploy da edge function.

