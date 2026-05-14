---
name: Payment After Break
description: Pagamentos recebidos em acordos quebrados/cancelados são aceitos, marcam parcela como paga com flag paid_after_break e disparam notificação para admin + criador do acordo
type: feature
---

**Cenário**: boleto continua ativo após acordo ser cancelado/quebrado; cliente paga mesmo assim.

**Comportamento (rebuild_agreement_installments)**:
- Quando `agreement.status IN ('cancelled','broken')` E parcela tem pagamento confirmado → marca `paid=true` + `paid_after_break=true`.
- Acordo NÃO é reaberto automaticamente (admin decide).
- Status canônico do CPF continua `quebra_acordo`.

**Notificação (trigger `trg_notify_payment_after_break`)**:
- Dispara em `AFTER UPDATE OF paid_after_break` quando vira `true`.
- Idempotente: checa `notifications` por `(tenant_id, type='payment_after_break', reference_id=installment_id)`.
- Notifica `agreements.created_by` + todos `profiles.role='admin'` do tenant.
- Type: `payment_after_break`, reference_type: `agreement_installment`.
- Também grava em `audit_logs` com action='payment_after_break'.

**Valor divergente é normal**: rebuild aceita QUALQUER pagamento confirmado (sem gating `>= amount - 0.01`). `paid_amount` reflete valor real recebido. Operador pode dar desconto/cobrar juros — comentário fica em `manual_payments.notes` com tag `[Divergência: contratado X, recebido Y — motivo]`.

**Tabela `payment_orphans`** (RLS por tenant): pagamentos sem `agreement_id` ou sem destino resolvível ficam aqui para reconciliação manual.
