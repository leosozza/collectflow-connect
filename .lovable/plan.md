

# Plano: Corrigir Dashboard, Relatórios e Analytics + Limite 1000 linhas

## Problemas Identificados

### 1. Dashboard — `total_recebido` exige `data_quitacao` (só conta quitação total)
A RPC `get_dashboard_stats` filtra `c.data_quitacao IS NOT NULL`. Pagamentos parciais (como os R$11 do Raul) nunca aparecem.

### 2. Relatórios — `totalRecebido` filtra `status === "completed"`
Linha 100 de `RelatoriosPage.tsx`: só soma `proposed_total` de acordos com status `completed`. Pagamentos parciais em acordos `pending` = R$0.

### 3. Relatórios — EvolutionChart mesma lógica errada
Linha 31 de `EvolutionChart.tsx`: `recebido` = soma de `proposed_total` onde `status === "completed"`.

### 4. Relatórios — query de agreements sem paginação (limite 1000)
Linha 47-51: `supabase.from("agreements").select("*")` sem `fetchAllRows` — corta em 1000.

### 5. Analytics — query de `allAgreementsFull` sem paginação (limite 1000)
Linha 144-152: mesma situação.

### 6. Callback Negociarie — não detecta quitação total
Após acumular `valor_pago`, nunca verifica se atingiu `proposed_total` para marcar `completed` e `data_quitacao`.

### 7. Analytics — já correto para `totalRecebido`
Usa `total_pago` real via RPC `get_analytics_payments`. Apenas o limite de 1000 na query `allAgreementsFull` precisa correção.

---

## Correções

### A. Migration SQL — Reescrever `total_recebido` na RPC `get_dashboard_stats`
Substituir a query que usa `data_quitacao` por uma que soma `clients.valor_pago` de clientes vinculados a acordos ativos no período, usando `client_events` (event_type = 'payment_confirmed') para filtrar por data de pagamento no mês.

### B. `src/pages/RelatoriosPage.tsx`
1. Usar RPC `get_analytics_payments` (que já retorna `total_pago` real por acordo) em vez de query direta à tabela `agreements`
2. Substituir `totalRecebido` para somar `total_pago` em vez de filtrar `status === "completed"`
3. Usar `fetchAllRows` na query de agreements (ou trocar pela RPC que já pagina via SQL)
4. Passar `total_pago` para o `EvolutionChart`

### C. `src/components/relatorios/EvolutionChart.tsx`
1. Aceitar `total_pago` nos dados do agreement
2. Linha "Recebido" = soma de `total_pago` em vez de `proposed_total` de `completed`

### D. `src/pages/AnalyticsPage.tsx`
1. Query `allAgreementsFull` (linha 144-152): usar `fetchAllRows` para paginar além de 1000

### E. `supabase/functions/negociarie-callback/index.ts`
Após acumular `valor_pago` no cliente (linha 125-129), adicionar lógica:
- Buscar `proposed_total` do agreement
- Se `newValorPago >= proposed_total`:
  - Atualizar `clients.data_quitacao = hoje`
  - Atualizar `agreements.status = 'completed'`
  - Registrar `client_event` tipo `agreement_completed`

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL (RPC `get_dashboard_stats`) | Recalcular `total_recebido` com `valor_pago` real via `client_events` |
| `src/pages/RelatoriosPage.tsx` | Usar RPC `get_analytics_payments` + `total_pago` para KPIs |
| `src/components/relatorios/EvolutionChart.tsx` | Usar `total_pago` para linha "Recebido" |
| `src/pages/AnalyticsPage.tsx` | `fetchAllRows` na query `allAgreementsFull` |
| `supabase/functions/negociarie-callback/index.ts` | Detectar quitação total e transitar acordo para `completed` |

## O que NÃO muda
- Geração de boleto / proxy Negociarie
- Nomenclaturas
- Fluxo de baixa manual
- RPC `get_analytics_payments` (já está correta)

