## Objetivo

Unificar a fonte de "valor recebido" em **Dashboard, Ranking e Campanhas Mensais** para que o operador VITOR (e todos os outros) mostrem o **mesmo número** em todas as telas.

---

## Diagnóstico (resumo dos 3 valores divergentes do VITOR em abril)

| Tela | Valor | Fonte atual | Problema |
|------|-------|-------------|----------|
| Dashboard | R$ 37.445,38 | `manual_payments` (confirmed+approved) + `portal_payments` (paid) + `negociarie_cobrancas` (pago), filtrado por `agreements.created_by` | ✅ Fonte mais completa |
| Ranking | R$ 43.994,09 | `client_events` (metadata.valor_pago/amount_paid) | ❌ Conta eventos duplicados ou eventos sem pagamento real conciliado |
| Campanha Mensal | R$ 28.049,04 | `manual_payments` (apenas confirmed) + `clients.valor_pago`, filtrado por credor TESS MODELS | ❌ Ignora "approved", ignora portal/negociarie, limita a 1 credor |

---

## Solução: Fonte Única de Verdade (SSoT)

Criar **1 RPC SQL** chamada `get_operator_received_total(operator_id, start_date, end_date, credor_id?)` que retorna o valor recebido por operador no período, usando a fórmula do Dashboard:

```
SUM(manual_payments.amount WHERE status IN ('confirmed','approved'))
+ SUM(portal_payments.amount WHERE status = 'paid')
+ SUM(negociarie_cobrancas.valor WHERE status = 'pago')
WHERE agreements.created_by = operator_id
  AND payment_date BETWEEN start_date AND end_date
  AND (credor_id IS NULL OR agreements.credor_id = credor_id)
```

Essa RPC vira a **única fonte** consumida por:
1. Dashboard (já usa essa lógica — apenas migra para a RPC)
2. Ranking de operadores (Gamificação)
3. Campanhas mensais (Gamificação) — com filtro opcional por credor

---

## Mudanças por arquivo

### 1. SQL (migration)
- Criar RPC `get_operator_received_total(p_operator_id uuid, p_start date, p_end date, p_credor_id uuid default null)` — `SECURITY DEFINER`, filtrada por `tenant_id` via `get_my_tenant_id()`.
- Criar RPC `get_operators_received_ranking(p_start date, p_end date, p_credor_id uuid default null)` — retorna lista `[{operator_id, operator_name, total_received}]` ordenada — usada por ranking e campanhas em lote.

### 2. `src/services/campaignService.ts`
- Substituir o cálculo atual (manual_payments confirmed + clients.valor_pago) pela chamada à RPC `get_operators_received_ranking`.
- Remover filtro hard-coded por credor TESS MODELS — usar `campaign.credor_id` (opcional, null = todos credores).

### 3. `src/hooks/useGamificationTrigger.ts` (ou serviço de ranking)
- Substituir leitura de `client_events` pela RPC `get_operators_received_ranking`.

### 4. Dashboard (`src/pages/Dashboard.tsx` ou hook correspondente)
- Migrar para a mesma RPC, garantindo que o número permaneça idêntico ao atual (R$ 37.445,38 para VITOR).

---

## Resultado esperado

VITOR — abril/2026:
- Dashboard: **R$ 37.445,38**
- Ranking: **R$ 37.445,38**
- Campanha mensal (todos credores): **R$ 37.445,38**
- Campanha mensal (filtrada TESS MODELS): valor parcial correspondente apenas a esse credor

---

## Validação pós-deploy

1. Abrir Dashboard → anotar valor do VITOR.
2. Abrir Gamificação → Ranking → confirmar mesmo valor.
3. Abrir Campanha Mensal (sem filtro de credor) → confirmar mesmo valor.
4. Abrir Campanha Mensal (filtro TESS MODELS) → confirmar valor ≤ total.
