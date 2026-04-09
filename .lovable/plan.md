

# Corrigir logs não aparecendo no dialog

## Problema

Os logs são gravados na tabela `webhook_logs` com `tenant_id = NULL`, mas a policy RLS exige que `tenant_id` corresponda ao tenant do usuário. Resultado: a query do frontend retorna zero registros.

## Causa raiz

A edge function `gupshup-proxy` insere logs sem `tenant_id`. A policy RLS:
```sql
tenant_id IN (SELECT id FROM tenants WHERE id = webhook_logs.tenant_id)
```
Filtra todos os registros com `tenant_id IS NULL`.

## Correções

### 1. `supabase/functions/gupshup-proxy/index.ts`

Receber o `tenantId` no body da requisição e incluí-lo ao inserir na `webhook_logs`:
```typescript
const { apiKey, appName, tenantId } = await req.json();
// ...
await writeLog(eventType, message, payload, statusCode, tenantId);
```

### 2. `src/components/integracao/WhatsAppIntegrationTab.tsx`

Passar o `tenant.id` na chamada ao `gupshup-proxy`:
```typescript
const { data, error } = await supabase.functions.invoke("gupshup-proxy", {
  body: { apiKey: apiKey.trim(), appName: appName.trim(), tenantId: tenant?.id },
});
```

### 3. `supabase/functions/gupshup-webhook/index.ts`

Verificar se os logs do webhook também incluem `tenant_id` ao inserir na `webhook_logs`. Se não, adicionar o tenant_id quando disponível.

### 4. Corrigir policy RLS (migração)

Atualizar a policy para também permitir leitura de logs com `tenant_id IS NULL` para usuários autenticados, OU garantir que todos os logs tenham tenant_id. A abordagem mais segura é garantir que todos os logs tenham tenant_id (opção das correções 1-3).

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/gupshup-proxy/index.ts` | Receber e passar `tenantId` ao `writeLog` |
| `src/components/integracao/WhatsAppIntegrationTab.tsx` | Enviar `tenant.id` no body |
| `supabase/functions/gupshup-webhook/index.ts` | Incluir `tenant_id` nos inserts de `webhook_logs` |

