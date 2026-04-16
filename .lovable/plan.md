

# Corrigir Status após Reabrir Parcelas

## Problema

Após reabrir parcelas, `recalcScoreForCpf` apenas recalcula o score de propensão (Edge Function `calculate-propensity`). Ela **não** aciona a `auto-status-sync`, que é a responsável por atualizar o `status_cobranca_id` (ex: de "Quitado" para "Inadimplente").

## Solução

Em `src/pages/ClientDetailPage.tsx`, no `handleReopenParcelas`, após o update das parcelas e antes do `refetch()`, chamar a Edge Function `auto-status-sync` com o `tenant_id` do cliente para recalcular o status do CPF/Credor.

### Alteração em `handleReopenParcelas`

```typescript
// Após os updates e recalcScoreForCpf:
const tenantId = clients[0]?.tenant_id;
if (tenantId) {
  await supabase.functions.invoke("auto-status-sync", { body: { tenant_id: tenantId } });
}
```

Isso garante que ao reabrir parcelas pagas, a hierarquia de status (QUITADO → INADIMPLENTE/EM DIA) seja recalculada automaticamente.

## Arquivo alterado
- `src/pages/ClientDetailPage.tsx` — adicionar chamada a `auto-status-sync` no handler de reabertura

