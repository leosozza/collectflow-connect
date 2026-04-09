

# Melhorar validação do teste de conexão + preparar teste de envio real

## Problema encontrado

1. **Credencial errada salva no banco** — A API Key salva (`sk_1047c...`) é diferente da que funciona no curl (`sk_4d0b3...`). O Gupshup retorna "Invalid App Details" porque a chave não corresponde ao app "Maxfama2".

2. **Teste de conexão aceita falsos positivos** — Atualmente qualquer resposta ≠ 401/403 é considerada "sucesso", mas "Invalid App Details" com status 400 claramente indica problema.

## Correções

### 1. `supabase/functions/gupshup-proxy/index.ts`

Após receber a resposta do Gupshup, verificar se o body contém `"status":"error"` com mensagem `"Invalid App Details"`. Se sim, retornar `success: false` com mensagem explicativa ("API Key não corresponde ao App Name informado").

```typescript
// Após parsear a resposta JSON:
if (data?.status === "error" && data?.message === "Invalid App Details") {
  // API Key válida mas não pertence ao app informado
  await writeLog(tenantId, "error", `App Name "${appName}" não corresponde à API Key`, ...);
  return Response({ success: false, error: "API Key válida, mas não corresponde ao App Name informado" });
}
```

### 2. Ação do usuário (pré-requisito para teste de envio)

Atualizar a API Key na interface de integração para a correta (`sk_4d0b33b6488d49d6ade15a3df3b0c99b`) e salvar.

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/gupshup-proxy/index.ts` | Detectar "Invalid App Details" como erro |

