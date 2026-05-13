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

**Trigger gating (importante):**
`tg_rebuild_from_agreement` só dispara `rebuild_agreement_installments` quando colunas que afetam o cronograma mudam (`new_installments`, `entrada_value`, `first_due_date`, `proposed_total`, `installment_breakdown`, `cancelled_installments`, `status`, etc). NÃO dispara em update de agregados (`paid_count`, `last_paid_at`...) — evita loop infinito com a trigger de Fase 4.

**Fase 4 — agregados em `agreements`:**
Colunas `paid_count`, `total_count`, `pending_count`, `overdue_count`, `last_paid_at`, `next_due_date`, `aggregates_updated_at` mantidas por `trg_agreement_installments_aggregate` (AFTER INSERT/UPDATE/DELETE em `agreement_installments`) chamando `recompute_agreement_aggregates(uuid)`. Backfill já executado para 703 acordos.

**Regras de uso (frontend):**
1. **Listagens/dashboards/contadores**: ler `agreements.paid_count/total_count` direto. Zero query extra.
2. **Lista de Acordos com filtro por mês ou ações por parcela**: usar `agreement_installments` via `fetchSSOTInstallments` + `classifySSOTInstallment`.
3. **Detalhe do cliente (botão "gerar boleto" etc)**: continuar usando classifier legado (`agreementInstallmentClassifier`) que tem acesso aos registros brutos para ações.

Classifier JS (`agreementInstallmentClassifier.ts`) permanece como fallback, mas qualquer nova feature deve preferir SSOT.
