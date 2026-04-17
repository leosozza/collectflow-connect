

## Diagnóstico — Entrada confirmada continua "vencida"

### Caso confirmado em produção
Acordo `8702f234` (Luis Fabiano):
- 2 entradas: `entrada` R$ 180 (vence 01/04) e `entrada_2` R$ 180 (vence 01/05)
- `manual_payment` R$ 190, `installment_number = 0`, `status = confirmed`, reviewed_at 16/04

**Sintoma:** após o admin confirmar, a 1ª entrada continua aparecendo como "vencida" na tabela de parcelas.

### Causa raiz — `installment_number` ambíguo para múltiplas entradas

Quando há mais de uma entrada, **todas** são gravadas com `installment_number = 0` (tanto no `ManualPaymentDialog` quanto na UI de edição em `PaymentConfirmationTab`). A UI também não distingue: ao baixar a Entrada 2, o sistema cria `installment_number = 0`. Resultado:

1. **Conflito de identidade:** baixa de Entrada 1 e Entrada 2 ficam indistinguíveis no banco — ambas `= 0`.
2. **Classificação errada na tabela:** `AgreementInstallments` (linha 191) e `agreementInstallmentClassifier.classifyInstallment` (linha 117) filtram `mp.installment_number === inst.number`. Como `inst.number` é sempre `0` para qualquer entrada, **todos os manual_payments confirmados de qualquer entrada são somados na primeira entrada** — e nada é atribuído à Entrada 2.
3. **No caso real:** R$ 190 ≥ R$ 180 → Entrada 1 deveria virar "pago". Por que continua "vencido"?
   - Em `AgreementInstallments` linha 196 a lógica é: `cobranca?.status || (isPaidManually ? "pago" : ...)`. Repare que **só o waterfall `agreementPaymentsTotal`** (linha 178) define `isPaidManually`. Esse waterfall vem de `clients.valor_total_pago` (não inclui `manual_payments`!). Como não há cobrança Negociarie paga e a soma do waterfall não cobre, cai em "vencido" mesmo com `manual_payments.confirmed`.
   - Ou seja: `AgreementInstallments` **ignora completamente os manual_payments confirmados** ao decidir "pago vs vencido". Só usa para detectar `pending_confirmation`.

### Bugs identificados

**Bug A — `AgreementInstallments` ignora manual_payments confirmados**
A classificação "pago" depende exclusivamente de `cobranca.status` ou do waterfall `clients.valor_total_pago`. Manual_payments confirmados não entram nessa decisão. Por isso a entrada continua "vencida" depois do aceite.

**Bug B — `installment_number` colide para múltiplas entradas**
Tanto a criação (`ManualPaymentDialog` recebe `inst.number = 0` para Entrada 1, 2, 3) quanto a confirmação tratam todas as entradas como a mesma parcela. Não dá para baixar individualmente Entrada 1 vs Entrada 2.

**Bug C — Edição de manual_payment não revalida cobertura**
`PaymentConfirmationTab.handleEdit` permite alterar `amount_paid` antes do aceite, mas não há lógica para reconciliar valores parciais (R$ 190 pagos numa entrada de R$ 180 — sobra R$ 10 que não é tratado).

**Bug D — Label do PaymentConfirmationTab não distingue entradas**
`getInstallmentLabel` retorna apenas "Entrada" para `installment_number === 0`. O admin não vê se está confirmando Entrada 1 ou Entrada 2.

### Correções (frontend + 1 migration leve)

**1. Migration: estender `manual_payments` com `installment_key TEXT`**
Adicionar coluna nullable `installment_key` (ex: `entrada`, `entrada_2`, `1`, `2`). Mantém `installment_number` para retrocompat (sempre `0` para entradas, `N` para parcelas), mas a chave canônica passa a ser `installment_key`. Backfill: `installment_key = 'entrada'` quando `installment_number = 0` e há só 1 entrada; senão `entrada_N`.

**2. `ManualPaymentDialog`** — aceitar `installmentKey: string` opcional além de `installmentNumber`. Persistir ambos.

**3. `AgreementInstallments.tsx` (linhas 142–198)** — passar `customKey` da entrada (ex: `entrada_2`) ao abrir o dialog; ao filtrar manual_payments para classificação, casar primeiro por `installment_key === inst.customKey`, fallback para `installment_number === inst.number` (legado).

**4. `AgreementInstallments` linha 196 — bug A** — incluir `manual_payments confirmed` na decisão "pago":
```ts
const confirmedManualForThis = manualPayments
  .filter(mp => (mp.installment_key === inst.customKey) || (!mp.installment_key && mp.installment_number === inst.number))
  .filter(mp => mp.status === "confirmed")
  .reduce((s, mp) => s + Number(mp.amount_paid || 0), 0);
const isPaidByManual = confirmedManualForThis >= inst.value - 0.01;
const status = pendingManual ? "pending_confirmation"
  : inst.cobranca?.status === "pago" ? "pago"
  : isPaidByManual ? "pago"
  : isPaidManually ? "pago"
  : isOverdue ? "vencido" : "pendente";
```

**5. `agreementInstallmentClassifier.classifyInstallment`** — mesma lógica de matching por `installment_key` com fallback.

**6. `PaymentConfirmationTab.getInstallmentLabel`** — quando `installment_key` começa com `entrada`, mostrar "Entrada 1", "Entrada 2", etc., usando o sufixo (ou índice baseado em `entradaCount` do acordo).

**7. AcordosPage `cobrancas`/`manualPayments` query** — incluir `installment_key` no `select`.

**8. Edição (PaymentConfirmationTab.handleEdit)** — manter como está; apenas garantir que se o admin alterar o valor para algo que cubra a parcela, a classificação posterior reconheça (já resolvido por #4).

### Resultado esperado
- Confirmar a baixa de R$ 190 da Entrada 1 (Luis Fabiano) → linha vira "pago" imediatamente.
- Operador consegue baixar Entrada 1 e Entrada 2 separadamente (cada uma com seu `installment_key`).
- Aba "Confirmação de Pagamento" mostra "Entrada 1 / Entrada 2" no rótulo.
- Acordos antigos (1 entrada, sem `installment_key`) continuam funcionando via fallback por `installment_number`.

### Sem alterações em
- RLS policies, `registerAgreementPayment`, lógica de quitação total do acordo (linha 248 do service).

