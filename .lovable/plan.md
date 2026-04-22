

## Análise: valor da parcela não muda após edição na tela de Acordos

### Caso da Camila Silva dos Santos Martins

Acordo ativo `d825253a` — `entrada_value=246,00`, parcelas 4× R$ 236,61.
Barbara fez baixa manual da entrada com valor real recebido = **R$ 246,48** (não R$ 246,00 — diferença provável de juros/centavos do PIX) e confirmou.

Estado no banco:
- `agreements.entrada_value` = **246,00** (intacto)
- `agreements.custom_installment_values["entrada"]` = **inexistente**
- `manual_payments.amount_paid` = **246,48** (status confirmed)

Resultado na UI: a parcela "Entrada" continua exibida como **R$ 246,00**, porque `buildInstallments` lê `customValues["entrada"] ?? agreement.entrada_value` → 246,00. O valor real (246,48) só aparece dentro do registro de `manual_payments`, nunca substitui o valor agendado da parcela.

### Causa raiz (3 lugares desconectados)

A operação "alterar valor da parcela" hoje vive em **três fluxos isolados** que não se sincronizam entre si:

1. **PaymentConfirmationTab → botão lápis (`handleEdit`):** edita só `manual_payments.amount_paid`. Propaga delta para `clients.valor_pago` e marca `agreements.completed` — mas **nunca grava o valor novo em `agreements.custom_installment_values[key]`**. A parcela continua com o valor original.
2. **AgreementInstallments → ícone editar valor (`handleEditValue`):** grava em `custom_installment_values[customKey]` (inclusive `"entrada"`), mas só funciona para parcelas **ainda não pagas**. Não revisa `manual_payments` já confirmados.
3. **ManualPaymentDialog (operador solicita baixa):** envia `amount_paid` livre, sem obrigar igual ao `installmentValue`. Aceita silenciosamente valores diferentes.

Como Barbara confirma uma baixa de R$ 246,48 contra uma parcela agendada de R$ 246,00, a parcela fica "paga" (porque 246,48 ≥ 246,00 − 0,01), mas o valor exibido continua sendo o agendado. Para o operador parece "que o valor não foi alterado".

### Correção proposta

Tornar a confirmação/edição em `PaymentConfirmationTab` **autoritativa sobre o valor da parcela** quando o valor pago divergir do valor agendado. Em ambos `handleConfirm` e `handleEdit`, após gravar em `manual_payments`:

1. Calcular `instValue` da parcela alvo via `buildInstallmentSchedule(agreement)` filtrando por `installment_key`.
2. Se `Math.abs(amount_paid - instValue) > 0.01`:
   - Atualizar `agreements.custom_installment_values[installment_key] = amount_paid` (mesma lógica de `updateInstallmentValue`).
   - Para parcela "entrada" sem múltiplas entradas, atualizar **também** `agreements.entrada_value = amount_paid` (para o `entrada_value` refletir a realidade).
   - Registrar `client_event` `installment_value_synced` com old/new para auditoria.
3. Invalidar queries `["client-agreements", cpf]` e `["agreement-cobrancas", ...]` para o detalhe do cliente atualizar imediatamente.

Adicionalmente, no `ManualPaymentDialog` (lado do operador): exibir um aviso amarelo "Valor pago difere do valor da parcela em R$ X,XX — ao confirmar, o valor da parcela será atualizado" quando `amountPaid !== installmentValue`. Sem bloquear, só transparente.

### Caso Camila — correção retroativa

O acordo `d825253a` da Camila já tem o pagamento confirmado com 246,48 mas a parcela mostra 246,00. Após o deploy do fix, qualquer **nova edição via lápis** sincroniza. Para o registro existente, vou rodar uma migração one-shot:

```sql
-- Backfill: para todo manual_payment confirmed onde amount_paid difere
-- do valor agendado da parcela em mais de R$ 0,01, gravar em custom_installment_values
-- e (se entrada única) em entrada_value.
```
Com `dry-run` antes do execute, mostrando quantos acordos serão tocados.

### Arquivos alterados

- `src/components/acordos/PaymentConfirmationTab.tsx` — adicionar sync `manual_payments.amount_paid` → `agreements.custom_installment_values` em `handleConfirm` e `handleEdit`.
- `src/components/acordos/ManualPaymentDialog.tsx` — alerta visual quando `amountPaid !== installmentValue`.
- `src/services/agreementService.ts` — extrair helper `syncInstallmentValueFromPayment(agreementId, installmentKey, paidAmount)` reutilizado por confirm/edit.
- Migração SQL one-shot (backfill) — sincronizar acordos já confirmados com divergência (Camila incluída).

### Validação pós-deploy

1. Abrir acordo da Camila no detalhe → entrada deve aparecer como **R$ 246,48** (não 246,00).
2. Criar novo acordo de teste, solicitar baixa com valor diferente do agendado, confirmar como admin → parcela exibida com o valor confirmado.
3. Editar valor de pagamento já confirmado via lápis → parcela atualiza junto.
4. Solicitar baixa com valor divergente do agendado → diálogo mostra alerta amarelo "Valor difere em R$ X,XX".

### Fora de escopo

- Refatorar `AgreementInstallments` em componentes menores.
- Mexer no `negociarie_cobrancas` — divergências de boletos PIX são tratadas em outro fluxo.
- Recriar histórico antigo em `client_events` para edições já feitas antes do fix.

