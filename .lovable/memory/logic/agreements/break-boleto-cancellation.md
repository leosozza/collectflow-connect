---
name: Agreement Break Boleto Cancellation
description: Trigger DB cancela boletos Negociarie ativos quando acordo vira broken/cancelled, respeitando prazo_dias_acordo do credor
type: feature
---

**Trigger**: `trg_cancel_boletos_on_break` em `AFTER UPDATE OF status ON agreements`. Dispara quando status muda para `broken` ou `cancelled`.

**Fluxo**:
1. Trigger chama edge function `cancel-agreement-boletos` via `pg_net.http_post` com header `x-cron-secret`
2. Edge function busca `negociarie_cobrancas` `agreement_id = X` ainda não pagas/canceladas
3. Para cada uma: se `data_vencimento + credores.prazo_dias_acordo > hoje`, PULA (boleto continua ativo dentro da janela de graça); senão, chama Negociarie `DELETE /cobranca/{id_parcela}` e marca `status=CANCELADO`
4. Loga tudo em `audit_logs` (`action=cancel_agreement_boletos`)

**Force mode**: body `{ force: true }` ignora prazo e cancela tudo imediatamente. Usado quando admin quer encerrar manualmente.

**Compatibilidade com payment-after-break**: boletos dentro da janela de graça continuam recebendo pagamento; fluxo existente de notificação + `paid_after_break` segue funcionando.

**Auth da function**: `x-cron-secret` (CRON_SECRET) OU `Authorization: Bearer <service_role>`. `verify_jwt = false`.
