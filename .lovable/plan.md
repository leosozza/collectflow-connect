

# Corrigir "Unexpected end of JSON input" no teste Gupshup

## Problema

Na linha 30 do `gupshup-proxy/index.ts`, `await response.json()` explode se a Gupshup retornar HTML ou corpo vazio. O erro genérico chega ao frontend sem contexto.

## Correções

### 1. `supabase/functions/gupshup-proxy/index.ts` — linha 30-31

Trocar:
```typescript
const data = await response.json();
console.log("Gupshup proxy test response:", data);
```
Por:
```typescript
const text = await response.text();
console.log("Gupshup proxy raw response:", text.substring(0, 500));

let data: any;
try {
  data = JSON.parse(text);
} catch {
  return new Response(JSON.stringify({
    success: false,
    error: `Gupshup retornou resposta inválida (status ${response.status}): ${text.substring(0, 200)}`,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### 2. `src/components/integracao/WhatsAppIntegrationTab.tsx` — linhas 54-56

Trocar:
```typescript
if (error || !data?.success) {
  throw new Error(data?.error || "Falha na conexão com Gupshup");
}
```
Por:
```typescript
if (error) {
  throw new Error(error.message || "Erro ao chamar gupshup-proxy");
}
if (!data?.success) {
  throw new Error(data?.error || "Falha na conexão com Gupshup");
}
```

Isso garante que erros de rede (edge function inacessível) e erros da Gupshup (credenciais inválidas, HTML em vez de JSON) sejam exibidos claramente no toast.

