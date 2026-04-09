

# Correção Estrutural: Separação Carteira × Acordo × Pagamento Real

## Resumo

Criar uma nova RPC consolidada `get_agreement_financials` que usa `agreement_id` como chave (não CPF+credor), migrar Analytics, Relatórios e PrestacaoContas para essa fonte, corrigir o fluxo de conclusão de acordo em `manualPaymentService.confirm` (approved→completed), e garantir isolamento por tenant nos filtros de operadores.

---

## 1. Nova RPC: `get_agreement_financials` (Migration SQL)

Substitui a atual `get_analytics_payments` como fonte de verdade para relatórios.

Consolida pagamentos reais por `agreement_id` a partir de:
- `manual_payments` (status = 'confirmed') — soma `amount_paid`
- `negociarie_cobrancas` (status = 'pago') — soma `valor_pago`
- Deduplicação: usa `COALESCE` para evitar dupla contagem quando mesma parcela tem baixa manual E cobrança paga

```sql
CREATE OR REPLACE FUNCTION public.get_agreement_financials(_tenant_id uuid)
RETURNS TABLE(
  agreement_id uuid,
  tenant_id uuid,
  created_by uuid,
  client_cpf text,
  client_name text,
  credor text,
  created_at timestamptz,
  first_due_date date,
  status text,
  original_total numeric,
  proposed_total numeric,
  entrada_value numeric,
  total_paid_real numeric,
  pending_balance_real numeric,
  payment_count bigint,
  first_payment_date date,
  last_payment_date date,
  paid_via_manual numeric,
  paid_via_negociarie numeric
)
```

Lógica interna:
- CTE `manual_totals`: agrupa `manual_payments` por `agreement_id` WHERE `status = 'confirmed'`
- CTE `negociarie_totals`: agrupa `negociarie_cobrancas` por `agreement_id` WHERE `status = 'pago'`
- `total_paid_real = COALESCE(manual, 0) + COALESCE(negociarie, 0)` (sem dupla contagem — esses são canais distintos)
- `pending_balance_real = GREATEST(proposed_total - total_paid_real, 0)`
- `payment_count`, `first/last_payment_date` derivados das duas tabelas via UNION

A RPC antiga `get_analytics_payments` será mantida por compatibilidade mas não será mais usada no frontend.

---

## 2. Corrigir `manualPaymentService.confirm` — Status `completed` (Frontend)

### Arquivo: `src/services/manualPaymentService.ts`

**Problema**: Linha 249 atualiza para `approved` quando totalmente pago. Deveria ser `completed`.

**Correção**:
- Linha 229: adicionar check `agreement.status !== "completed"` (já existe) — OK
- Linha 249: trocar `status: "approved"` → `status: "completed"`
- Adicionar guarda: nunca regredir de `completed`

```typescript
// Quando totalmente pago:
if (totalPaid >= (agreement.proposed_total || 0) - 0.01 && agreement.proposed_total > 0) {
  // Nunca regredir de completed
  if (agreement.status !== "completed") {
    await supabase
      .from("agreements")
      .update({ status: "completed" })
      .eq("id", mp.agreement_id);
  }
  // ...client update mantém igual
}
```

**Callback Negociarie** (`supabase/functions/negociarie-callback/index.ts`):
- Já usa `completed` corretamente na função `checkAgreementCompletion` (linha 60) ✓
- Já tem guarda `agreement.status === "completed"` (linha 37) ✓
- **Nenhuma alteração necessária** no callback

---

## 3. Corrigir `AnalyticsPage.tsx`

### Mudanças:
- Substituir chamada `get_analytics_payments` → `get_agreement_financials`
- KPIs corrigidos:
  - **Total Negociado** = soma `proposed_total` dos ativos (sem cancelled) — mantém
  - **Total Recebido** = soma `total_paid_real` — **corrigido**
  - **Total Quebra** = soma `proposed_total` dos cancelled — mantém
  - **Taxa Recuperação** = `total_paid_real / total_negociado` — mantém conceito
  - **Ticket Médio** = `total_paid_real / acordos com pagamento` — **corrigido** (usa real)
  - **% Recebimento** = acordos com `total_paid_real > 0` / ativos — mantém
  - **Taxa Conversão** = mantém conceito atual com pagamento real

### Evolução Mensal — separação temporal:
- **Negociado**: por `created_at` do acordo (mantém)
- **Recebido**: por `last_payment_date` do acordo (novo — mês real do pagamento)
- **Quebra**: por `created_at` (limitação: não existe `cancelled_at` na tabela agreements — documentar)

Para recebido mensal correto, a RPC precisará de um campo adicional ou usaremos dados de `first_payment_date`/`last_payment_date`. Como não temos granularidade mensal de pagamentos na RPC, vamos criar uma segunda CTE que retorna pagamentos mensais:

Alternativa pragmática: manter `created_at` para recebido por enquanto com comentário, e usar `total_paid_real` em vez de `proposed_total` como valor. Isso já é uma melhora significativa (valor real vs. valor proposto).

---

## 4. Corrigir `RelatoriosPage.tsx`

### Mudanças:
- Substituir chamada `get_analytics_payments` → `get_agreement_financials`
- KPIs da Visão Geral:
  - **Total Acordos** = contagem de ativos (sem cancelled)
  - **Total Recebido** = soma `total_paid_real`
  - **Total Quebra** = soma `proposed_total` dos cancelled
  - **Total Pendente** = soma `pending_balance_real`
- Aging continua usando `clients` (métrica de carteira) ✓ — sem alteração
- EvolutionChart: usar `total_paid_real` para recebido

### Filtro de operadores — isolamento por tenant:
- Linha 46-49: query de profiles **não filtra por tenant_id**
- Corrigir para: `.eq("tenant_id", tenant.id)` na query de profiles

---

## 5. Corrigir `PrestacaoContas.tsx`

### Mudanças no resumo (linhas 80-88):
- `recebido` = soma `total_paid_real` dos acordos do credor (em vez de `proposed_total` de completed)
- `pendente` = soma `pending_balance_real` (em vez de `proposed_total` de pendentes)
- `quebra` = soma `proposed_total` dos cancelled (mantém)
- `taxa` = `recebido / (recebido + quebra)` (mantém conceito, agora com dados reais)

### Ranking de operadores (linhas 116-129):
- `received` = soma `total_paid_real` por `created_by` (em vez de `proposed_total` de completed)
- `broken` = soma `proposed_total` dos cancelled (mantém)

### EvolutionChart (RelatoriosPage):
- Passar `total_paid_real` como `total_pago` para o componente

---

## 6. Arquivos modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| Migration SQL | DB | Nova RPC `get_agreement_financials` |
| `src/services/manualPaymentService.ts` | Fix | `approved` → `completed` quando totalmente pago |
| `src/pages/AnalyticsPage.tsx` | Refactor | Migrar para `get_agreement_financials` |
| `src/pages/RelatoriosPage.tsx` | Refactor | Migrar para `get_agreement_financials` + fix tenant em profiles |
| `src/components/relatorios/PrestacaoContas.tsx` | Refactor | Usar `total_paid_real` para métricas |
| `src/components/relatorios/EvolutionChart.tsx` | Sem alteração | Já recebe dados filtrados como prop |
| `src/components/relatorios/AgingReport.tsx` | Sem alteração | Métrica de carteira (clients) |
| `supabase/functions/negociarie-callback/index.ts` | Sem alteração | Já usa `completed` corretamente |

---

## 7. O que NÃO será alterado

- Status de agreements: `pending_approval → pending → approved → completed / cancelled / rejected`
- Status de clients: `pendente, pago, quebrado, em_acordo, vencido`
- `status_cobranca_id` e progressões visuais
- Automações de jornada comercial
- Telas de atendimento, carteira, portal, acordos
- Callback da Negociarie (já correto)
- Dashboard RPCs (`get_dashboard_stats`, `get_dashboard_vencimentos`)
- `registerAgreementPayment` (distribuição em clients — mantém para operação de carteira)

---

## 8. Comentários no código

Cada arquivo terá comentários claros:
```typescript
// === MÉTRICA DE CARTEIRA === (dados de clients — títulos/parcelas originais)
// === MÉTRICA DE ACORDO === (dados de agreements — negociação formalizada)
// === PAGAMENTO REAL CONSOLIDADO === (manual_payments + negociarie_cobrancas por agreement_id)
```

