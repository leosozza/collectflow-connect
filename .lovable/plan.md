

# Corrigir teste de conexão — incluir número de telefone real

## Problema

O `gupshup-proxy` envia `source=validation` e `destination=0` como valores fictícios. A Gupshup rejeita com "Invalid App Details" porque o `source` não corresponde a nenhum número registrado no app. O curl do usuário funciona porque usa o número real `5511971306153`.

## Correção

### 1. `src/components/integracao/GupshupConfigDialog.tsx`

Enviar o `sourceNumber` junto no body da chamada ao proxy:

```typescript
body: { apiKey, appName, sourceNumber: sourceNumber.trim(), tenantId: tenant?.id }
```

### 2. `supabase/functions/gupshup-proxy/index.ts`

- Extrair `sourceNumber` do body da request
- Usar o número real no campo `source` em vez de `"validation"`
- Usar um destino válido (o próprio número) em vez de `"0"`

```typescript
const { apiKey, appName, tenantId, sourceNumber } = await req.json();
const src = sourceNumber || "validation";
const dst = sourceNumber || "0";
const requestBody = `channel=whatsapp&source=${encodeURIComponent(src)}&src.name=${encodeURIComponent(appName)}&destination=${encodeURIComponent(dst)}&message={}`;
```

### 3. `WhatsAppIntegrationTab.tsx`

Atualizar `handleTestConnection` para enviar o `sourceNumber` das settings do tenant:

```typescript
body: { apiKey, appName, sourceNumber: settings.gupshup_source_number, tenantId: tenant.id }
```

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/integracao/GupshupConfigDialog.tsx` | Enviar `sourceNumber` no body |
| `supabase/functions/gupshup-proxy/index.ts` | Usar número real no `source` e `destination` |
| `src/components/integracao/WhatsAppIntegrationTab.tsx` | Enviar `sourceNumber` no teste externo |

