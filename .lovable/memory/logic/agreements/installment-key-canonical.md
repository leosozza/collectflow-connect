---
name: Installment Key Canonical
description: Canonical convention for agreement installment keys, SSOT in agreement_installments, and materialized aggregates on agreements
type: feature
---

**Convenção canônica de installment_key:**
- `entrada`, `entrada_2`, `entrada_3` para pagamentos à vista
- `1`, `2`, ..., `N` para parcelas mensais — sempre 1..N independente de existir entrada
- `displayNum` (ex: "2/12") é só rótulo visual, não é chave de match

**SSOT — `agreement_installments`:**
Tabela materializada via `rebuild_agreement_installments(uuid)` chamada por trigger em `agreements`, `manual_payments`, `negociarie_cobrancas`. Contém `installment_key`, `due_date`, `amount`, `paid`, `paid_at`, `paid_source`, `cancelled`, `pending_confirmation`. SSOT única de "esta parcela está paga?".

**Trigger gating:** `tg_rebuild_from_agreement` só dispara em colunas que afetam o cronograma — não em agregados (evita loop com Fase 4).

**Fase 4 — agregados em `agreements`:** `paid_count`, `total_count`, `pending_count`, `overdue_count`, `last_paid_at`, `next_due_date`, `aggregates_updated_at` mantidas por `trg_agreement_installments_aggregate`.

**Regras de uso (frontend):**
1. **Listagens/dashboards/contadores**: ler `agreements.paid_count/total_count` direto.
2. **Lista de Acordos com filtro/ações por parcela**: usar `agreement_installments` via `fetchSSOTInstallments` + `classifySSOTInstallment`.
3. **Detalhe do cliente (`AgreementInstallments.tsx`)**: classifier legado constrói o objeto `inst` (preserva ações), mas o **status final é sobreposto pela SSOT**. Realtime em `agreement_installments` + invalidação React Query em `["agreement-installments-ssot", agreementId]` e `["carteira-grouped"]` em todo write path.

**Fase 5.1 — Dashboard:** `get_dashboard_stats_v2` e `get_financial_received_by_day` leem SSOT (timezone America/Sao_Paulo). Demais métricas reaproveitadas. Não aceita `_tenant_id`.

**Fase 5.3 — Status consolidado da Carteira:**
- RPC `get_client_consolidated_status(_tenant_id, _cpf, _credor, _atraso_quebra_dias=15)` retorna canônico: `quitado | acordo_vigente | acordo_atrasado | quebra_acordo | inadimplente | em_dia`. Lê SSOT (`agreement_installments`) + `agreements` + `clients`.
- Hierarquia: `quebra_acordo > acordo_atrasado > acordo_vigente > quitado`; sem acordo, decide entre `inadimplente`/`em_dia`/`quitado` por `clients`.
- `agreement.status='cancelled'` → `quebra_acordo`; parcela vencida há > 15 dias → `quebra_acordo`.
- Helper `map_canonical_to_legacy_status` mapeia para o contrato textual antigo (`pago/em_acordo/quebrado/vencido/pendente`) — frontend não muda.
- `get_carteira_grouped` agora chama essa função no nível do grupo (par CPF/Credor), substituindo a derivação de `clients.status`. Validação amostral: 199/200 pares convergem; única divergência foi correção SSOT (acordo `em_acordo` legado → `quebrado` real).
- Writes de pagamento manual / cancelamento / boleto invalidam também `["carteira-grouped"]`.

Classifier JS (`agreementInstallmentClassifier.ts`) permanece como fallback, mas qualquer nova feature deve preferir SSOT.
