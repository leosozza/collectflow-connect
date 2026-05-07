## Correção: SSOT em AgreementInstallments.tsx

Eliminar a lógica FIFO concorrente que está marcando parcelas como pagas sem que tenha havido pagamento real para aquela chave.

### Arquivo único
`src/components/client-detail/AgreementInstallments.tsx`

### Mudanças

1. **Remover** os memos `allPaymentRecords` e `totalPaidFromClients` (linhas ~128‑143). Ficam órfãos.

2. **Remover** `let remainingPaid = totalPaidFromClients;` e o bloco `if (remainingPaid >= instValue) { isPaidManually = true; ... } else { remainingPaid = 0; }` (linhas 219, 232‑237).

3. **Remover** `isPaidManually` da expressão de status (linhas 257‑258). Nova cadeia:
   ```
   pending_confirmation → cobranca.status === "pago" → isPaidByManual → isOverdue ? "vencido" : "pendente"
   ```

4. **Substituir** o cálculo FIFO de `paidAt` (linhas 262‑278) por:
   - `inst.cobranca?.data_pagamento`, ou
   - `payment_date` / `confirmed_at` / `created_at` do `manual_payment` confirmado que casou com a parcela (mesmo predicado `matchesInst`).
   - Sem fonte → `paidAt` indefinido (UI mostra "—" em vez de inventar data).

### Não tocar
- `buildInstallmentSchedule` / `classifyInstallment` (já estritos)
- RPCs, `manual_payments`, `negociarie_cobrancas`
- Geração de boletos
- Edição de data/valor, cancelamento, reativação
- Outras telas (Acordos, Financeiro, Portal já usam SSOT canônica)

### Resultado esperado para o Renato
- Entrada: Pago 07/04 (cobrança `:0`)
- 2/6: **Em Aberto** (não há cobrança nem baixa manual com chave `:1`)
- 3/6: Pago 07/05 (cobrança `:2`)
- Progresso: 2/6 (refletindo a realidade)
