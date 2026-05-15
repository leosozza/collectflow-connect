## Fixes rápidos antes da Visão 360

Dois ajustes pontuais nas mudanças do Maxlist → Acordo, sem mexer em comportamento de negócio.

### 1. Normalizar credor na RPC `create_reconciliation_alerts_from_maxlist`

**Problema:** comparação literal `agreements.credor = _payment->>'credor'` falha se houver diferença de caixa/espaço entre `clients.credor` e `agreements.credor`.

**Ajuste (migration):** trocar a comparação para
```
UPPER(BTRIM(agreements.credor)) = UPPER(BTRIM(_payment->>'credor'))
```
Mantém todo o resto da função igual (CPF normalizado, status `approved/overdue`, ORDER BY `created_at DESC LIMIT 1`).

### 2. Modal `ReconciliationAlertModal` — localizar baixa por `installment_key`

**Problema:** `handlePaymentSuccess` busca o `manual_payment` recém-criado por `installment_number`. Em acordos com entrada (entrada + parcelas 1..N), pode colidir entre "Entrada" e "Parcela 1".

**Ajuste:** quando o alerta tiver `installment_key` (sempre tem hoje), buscar por `installment_key` em vez de `installment_number`. Fallback para `installment_number` apenas se `installment_key` for nulo (compatibilidade).

```ts
let q = supabase.from("manual_payments").select("id")
  .eq("tenant_id", tenantId)
  .eq("agreement_id", agreementId)
  .eq("status", "pending_confirmation")
  .order("created_at", { ascending: false }).limit(1);
q = installmentKey ? q.eq("installment_key", installmentKey)
                   : q.eq("installment_number", installmentNumber);
```

### Não está incluído neste ciclo
- Trocar auto-status-sync por `sync_clients_status_loop` (item #4)
- Fila central de Alertas de Conciliação + badge na lista de Acordos (item #5)
- Qualquer ajuste do Dashboard 360 (você vai me explicar a seguir)

### Arquivos afetados
- **Nova migration**: `CREATE OR REPLACE FUNCTION public.create_reconciliation_alerts_from_maxlist(...)` com normalização de credor.
- **Edit**: `src/components/acordos/ReconciliationAlertModal.tsx` (`handlePaymentSuccess`).
