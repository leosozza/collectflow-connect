## Objetivo

Travar a lógica de baixa (manual + Negociarie) tratando dois cenários reais como **normais** (com aviso), não como erro:

1. **Valor pago ≠ valor da parcela** (operador deu desconto / cobrou juros) → aceitar o valor digitado, marcar parcela como paga, anexar comentário.
2. **Parcela paga depois do acordo quebrado** (boleto continuou ativo) → aceitar a baixa, marcar parcela como paga, **avisar admin + operador do acordo** via sininho.

E reconciliar os 9 órfãos atuais da Y.BRASIL com essa mesma lógica.

---

## Parte 1 — Reconciliação dos 9 órfãos atuais (Y.BRASIL)

Migration `reconcile_orphan_payments_ybrasil()` (one-shot, idempotente):

| Caso | Ação |
|---|---|
| Natani (R$118,87 vs 133,52) | Marca parcela 1 como paga, valor = 118,87, comentário "Baixa com valor divergente — desconto/ajuste do operador" |
| Carolina (−R$0,12) | Idem parcela 1 |
| Maria Aux. (−R$1,00) | Idem parcela 1 |
| Samantha (legacy `installment_number=2`) | Match por `installment_key='1'` (canônica), marca paga |
| Valdenice (`:1` sem parcela 1) | Backfill: cria `installment_key=':1'` na SSOT com valor pago, marca paga, log "Parcela paga após quebra de acordo" |
| Ivanessa (key vazia) | Match por `data_vencimento + valor`, fallback parcela 1 |
| Fernanda (`:0` legado) | Re-mapeia para `entrada` |
| Gabriella (duplicata) | Marca a 2ª como `superseded` em `manual_payments`/`negociarie_cobrancas`, **não** mexe na parcela |
| Sem nome (sem agreement_id) | Insere em nova tabela `payment_orphans` com motivo `missing_agreement_id` |

Cada caso gera linha em `audit_logs` com `action='orphan_reconciled'` + metadata.

---

## Parte 2 — Trigger canônico de reflexão (anti-órfão futuro)

Reescreve `reflect_payment_to_installment()` com regras determinísticas:

```text
1. Se installment_key presente → match exato em agreement_installments
2. Se ausente → match por (agreement_id, data_vencimento, valor ±5%)
3. Se ainda assim não achar:
   - INSERT em payment_orphans (tenant, source, ref_id, motivo)
   - INSERT notification para admin do tenant
4. Se achar parcela já paga (não-cancelada) com source diferente:
   - Marca o pagamento novo como 'duplicate_ignored'
   - audit_log + notification "Pagamento duplicado detectado"
5. Sempre persiste paid_amount = valor REAL recebido (não o valor da parcela)
```

Nova tabela `payment_orphans`:
- `tenant_id, source ('manual'|'negociarie'|'portal'), source_ref_id, agreement_id, amount, paid_at, reason, resolved_at`
- RLS por tenant; admin pode resolver manualmente via UI futura

---

## Parte 3 — Valor divergente é NORMAL (não bloqueia)

### Backend
- Ao confirmar baixa manual, se `|amount_paid - installment.amount| > 0.01`:
  - **Aceita** o pagamento normalmente
  - Atualiza `agreement_installments.paid_amount = amount_paid` (valor real)
  - **Não** altera `agreement_installments.amount` (valor contratado fica preservado para histórico)
  - Insere comentário automático em `agreement_installment_notes` (nova tabela leve) ou em `manual_payments.notes` prefixado: `[Divergência: contratado R$X, recebido R$Y — desconto/juros aplicado pelo operador]`

### Frontend (`AgreementInstallments.tsx`)
- Badge discreto na parcela: ⚠️ "Valor ajustado" (tooltip mostra contratado vs pago + observação)
- Em `ManualPaymentDialog`: remove o aviso amarelo atual de "será atualizado" — substitui por campo opcional **"Motivo do ajuste"** (desconto / juros / outro), salvo em `notes`

---

## Parte 4 — Pagamento após quebra de acordo (NORMAL + alerta)

### Backend
Trigger detecta no momento da reflexão:
```text
SE agreement.status IN ('cancelled','broken') E pagamento entrou depois de status_changed_at:
  - Marca parcela como paga normalmente
  - Adiciona flag agreement_installments.paid_after_break = true
  - Cria notification para:
      • admin(s) do tenant
      • operador dono do acordo (agreements.operator_id / created_by)
    Título: "Pagamento recebido em acordo quebrado"
    Mensagem: "Cliente {nome} pagou parcela {N} de R$ {valor} mesmo com acordo quebrado em {data}."
    reference_type='agreement', reference_id={agreement_id}
  - audit_logs action='payment_after_break'
```

### Frontend (`AgreementInstallments.tsx`)
- Badge na parcela: 🔔 "Paga após quebra" (vermelho suave, tooltip com data da quebra)
- Sininho (`NotificationBell`) já consome `notifications` — apenas garantir que o tipo novo `payment_after_break` aparece com ícone/cor adequados

### Não muda
- O acordo permanece `cancelled/broken` (não "ressuscita" automaticamente — admin decide se reativa manualmente)
- Status canônico do CPF: continua `quebra_acordo` até admin reabrir

---

## Parte 5 — Travamento (memória + docs)

Após aprovação e migration aplicada, atualizo:
- `mem://logic/agreements/installment-key-canonical` — adiciona regras 1-5 do trigger + paid_amount real
- `mem://features/billing/manual-payment-confirmation` — divergência é normal, fluxo de comentário
- Nova memória `mem://logic/agreements/payment-after-break` — comportamento + notificação
- Marca como **lógica congelada** — qualquer mudança futura precisa de aprovação explícita

---

## Entregáveis técnicos

1. Migration `reconcile_orphans_and_harden_reflection.sql`:
   - Reconcilia os 9 (com `SET LOCAL app.force_status_override`)
   - Cria tabela `payment_orphans` + RLS
   - Adiciona coluna `agreement_installments.paid_after_break BOOLEAN DEFAULT false`
   - Adiciona coluna `agreement_installments.paid_amount NUMERIC` (se ainda não existir como real)
   - Reescreve `reflect_payment_to_installment()` com as 5 regras
   - Trigger de notificação `notify_payment_after_break()`
2. Edge `negociarie-webhook`: rejeita HTTP 400 se `agreement_id` ausente; aceita `installment_key` vazio (deixa trigger resolver)
3. `ManualPaymentDialog.tsx`: troca aviso amarelo por campo "Motivo do ajuste"
4. `AgreementInstallments.tsx`: 2 badges novos (valor ajustado / paga após quebra) + tooltip
5. `NotificationBell` / list: ícone para `payment_after_break`

---

## Validação final

```sql
-- Deve retornar 0 linhas
SELECT * FROM payment_orphans WHERE tenant_id = 'YBRASIL' AND resolved_at IS NULL;

-- Deve bater exato
SELECT
  (SELECT SUM(amount_paid) FROM manual_payments WHERE tenant_id='YBRASIL' AND status='confirmed' AND date_trunc('month',payment_date)='2026-05-01')
  + (SELECT SUM(valor_pago) FROM negociarie_cobrancas WHERE tenant_id='YBRASIL' AND status='pago' AND date_trunc('month',data_pagamento)='2026-05-01')
  AS ssot_recebido,
  (SELECT SUM(paid_amount) FROM agreement_installments WHERE tenant_id='YBRASIL' AND paid AND date_trunc('month',paid_at)='2026-05-01') AS ssot_parcelas;
-- ssot_recebido = ssot_parcelas (diferença esperada: 0)
```

Posso aplicar?