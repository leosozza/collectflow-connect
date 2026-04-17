---
name: Manual Payment Confirmation
description: Admin manual payment confirmation rules, payee limits, and per-installment identification via installment_key
type: feature
---
Fluxo de baixa manual de parcelas (aba 'Acordos') com aprovação obrigatória por administrador. O operador solicita a baixa via `ManualPaymentDialog`; admin confirma/recusa em `PaymentConfirmationTab`.

**Identificação canônica por installment_key (TEXT):**
A tabela `manual_payments` possui a coluna `installment_key` (`entrada`, `entrada_2`, `entrada_3`, `1`, `2`, ...) como chave canônica para identificar a parcela exata — essencial para acordos com múltiplas entradas onde `installment_number = 0` colide entre todas as entradas.

**Regras de matching para classificação "pago":**
- Match primário: `mp.installment_key === inst.customKey`
- Fallback (legado): `mp.installment_number === inst.number` quando `installment_key` é null
- Aplicado tanto em `AgreementInstallments.tsx` (UI inline) quanto em `agreementInstallmentClassifier.classifyInstallment` (lista global de Acordos)

**Bug histórico corrigido:** `AgreementInstallments` antigamente ignorava `manual_payments confirmed` ao decidir "pago vs vencido" — só considerava `clients.valor_total_pago`. Agora soma `confirmedManualForThis` e marca "pago" se cobre o valor da parcela.

**Receivers permitidos:** `CREDOR` ou `COBRADORA`.
**Methods permitidos:** PIX, Transferência, Depósito, Dinheiro, Outro.

Confirmação consolida total (`manual_payments confirmed` + `negociarie_cobrancas pago`) e marca acordo como `completed` quando `totalPaid >= proposed_total`.
