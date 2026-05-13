
## Diagnóstico confirmado (banco real, agora)

### Problema 1 — Dashboard ≠ Baixas Realizadas (R$ 1.005,42 de diferença em Maio)

| Métrica | Valor | Fonte |
|---|---|---|
| Baixas Realizadas (Maio/2026, Y.BRASIL) | **R$ 58.867,23** | UNION manual_payments + portal_payments + negociarie_cobrancas (tabelas brutas) |
| Dashboard "Total Recebido" | **R$ 57.861,81** | `agreement_installments` (SSOT) onde `paid=true` |
| Diferença | R$ 1.005,42 | 8 pagamentos brutos sem `paid=true` na SSOT |

A causa é a mesma já mapeada na memory `negociarie-cobranca-lookup`: depois das mudanças deste mês, alguns pagamentos brutos não conseguem casar com a parcela canônica na SSOT (chave legada com prefixo do agreement_id, entrada com offset, `data_vencimento` sem match exato). Eles **continuam corretos** em `negociarie_cobrancas`/`manual_payments` (Baixas mostra) mas a SSOT não reflete (Dashboard encolhe).

### Problema 2 — "Invalid Date" na coluna Pagamento da tela de Acordos

Bug isolado em `src/lib/formatters.ts:21-23`:

```ts
export const formatDate = (date: string): string =>
  new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
```

E em `AgreementInstallments.tsx:420`:

```ts
paidAt: ssotRow.paid_at || inst.paidAt,
```

`ssotRow.paid_at` é um **timestamp ISO completo** (`2026-05-13T14:23:55.000Z`). O legado armazenava só `YYYY-MM-DD`. Então `formatDate` concatena `+ "T00:00:00"` virando `"2026-05-13T14:23:55.000ZT00:00:00"` → **Invalid Date**.

Antes da migração SSOT, `paidAt` vinha do classifier como `YYYY-MM-DD` (data do `manual_payments.payment_date` ou `negociarie_cobrancas.data_pagamento`). Agora a SSOT sobrescreve com o timestamp completo do `paid_at` e quebra o `formatDate`.

## Princípio confirmado pelo usuário

> **Baixas Realizadas é a verdade.** O Dashboard tem que refletir Baixas, e nunca o contrário. A data de pagamento exibida tem que ser a data **registrada na baixa** (manual ou cobrança Negociarie), não um timestamp interno da SSOT.

## Correção (mínima, cirúrgica, sem migrar dados em massa)

### Fix 1 — Dashboard passa a ler da fonte de Baixas Realizadas

Alterar **2 funções SQL** (única mudança no backend):

- **`get_dashboard_stats_v2`**: trocar o cálculo de `_recebido_ssot` e `_recebido_ant_ssot`. Em vez de `SUM(agreement_installments.paid_amount WHERE paid)`, somar exatamente o mesmo UNION que `get_baixas_realizadas` usa (manual_payments confirmados + portal_payments pagos + negociarie_cobrancas pagas), filtrado por `payment_date BETWEEN _month_start AND _month_end` e por operador.
- **`get_financial_received_by_day`** (gráfico do card "Total Recebido"): mesma troca — `GROUP BY payment_date` em cima do UNION dos 3, em vez de `paid_at` da SSOT.

Resultado imediato após migrar: o número da Maria Eduarda (e de todos os operadores e do total do tenant) **bate exato** com Baixas Realizadas, sem alterar uma única linha de pagamento.

### Fix 2 — Coluna "Pagamento" volta a mostrar a data real da baixa

Duas mudanças cirúrgicas:

**a) `src/lib/formatters.ts` — tornar `formatDate` defensivo** (qualquer entrada — `YYYY-MM-DD`, ISO timestamp, `Date`, ou string vazia):

```ts
export const formatDate = (input: string | Date | null | undefined): string => {
  if (!input) return "—";
  const s = typeof input === "string" ? input : input.toISOString();
  // Aceita "YYYY-MM-DD" puro OU timestamp ISO completo
  const d = s.length === 10 ? new Date(s + "T00:00:00") : new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};
```

Isso já elimina "Invalid Date" em **toda** a UI sem riscos.

**b) `src/components/client-detail/AgreementInstallments.tsx:420` — preferir a data da baixa real**

Ao sobrepor com SSOT, manter como `paidAt` a data **registrada na baixa** (que é o que o operador vê em Baixas Realizadas e o que ele espera). Hoje o classifier já calcula `paidAt` a partir de `manual_payments.payment_date` ou `negociarie_cobrancas.data_pagamento` — basta **não** sobrescrever:

```ts
if (ssotRow.paid) {
  return {
    ...inst,
    status: "pago",
    paidAt: inst.paidAt || ssotRow.paid_at,  // prioriza data da baixa real
  };
}
```

Assim, mesmo se a SSOT tiver `paid_at` com timestamp diferente, a coluna Pagamento mostra a **mesma data** que aparece em Baixas Realizadas.

### Fora de escopo (intencional)

- **Não vamos** rodar backfill, rebuild em massa, nem mexer em `manual_payments` / `negociarie_cobrancas` / `agreement_installments`.
- **Não vamos** alterar a tela Baixas Realizadas (já é a verdade).
- **Não vamos** criar tabelas, triggers, edge functions ou shadow-checks novos.
- A SSOT continua existindo e sendo útil para status de parcela, `next_due_date`, agregados — apenas deixa de ser fonte de "Recebido em R$" nas telas financeiras.

## Memórias a atualizar

- `mem://logic/agreements/installment-key-canonical`: adicionar regra explícita "**Recebido em R$ = UNION das tabelas de pagamento bruto** (manual_payments + portal_payments + negociarie_cobrancas). SSOT em `agreement_installments` é apoio para status/agregados, NUNCA fonte de soma financeira."
- `mem://logic/relatorios/consolidacao-pagamentos`: mesma regra reforçada.
- `mem://features/dashboard/unified-interface`: documentar que Total Recebido segue Baixas Realizadas.

## Ordem de execução

1. Migração SQL alterando `get_dashboard_stats_v2` e `get_financial_received_by_day` (Fix 1).
2. Edição de `src/lib/formatters.ts` (Fix 2a) e `AgreementInstallments.tsx` linha 420 (Fix 2b).
3. Atualizar as 3 memories.
4. Refresh do Dashboard e do detalhe do cliente Kethlenn — números batem com Baixas, "Invalid Date" some.

