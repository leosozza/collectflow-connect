

## Plano: corrigir baixa manual com valor diferente da parcela (caso Camila/Bárbara)

### O que aconteceu de fato (investigação no banco)

1. O acordo onde Bárbara lançou **R$ 251,99** **não é da Camila** — é da cliente **Ezi Mitel de Souza Fleury** (acordo `3fee4f9c`), parcela 1 (valor agendado original: R$ 252,73). Camila tem outro acordo (`d825253a`), entrada R$ 246,48, e esse já está sincronizado.
2. Bárbara confirmou a baixa de R$ 251,99 da Ezi em **17/04** — antes da correção de sync que entrou hoje. Naquele momento `custom_installment_values["1"]` ficou R$ 252,73 (valor original), e a UI continuou mostrando 252,73.
3. Como "não atualizou", Bárbara hoje (22/04) **lançou uma segunda baixa** de R$ 251,99 para a mesma parcela 1 → confirmou de novo → agora `custom_installment_values["1"] = 251,99` ✅, mas o acordo tem **duas confirmações** para a mesma parcela (251,99 + 251,99 = R$ 503,98 contabilizados, em vez de R$ 251,99).
4. Levantamento mostra **20+ acordos com baixas duplicadas** e **9+ acordos com `amount_paid` ainda divergente** que o backfill anterior não pegou.

### Causa raiz de cada problema

| Problema | Causa |
|---|---|
| **A. UI mostra valor original mesmo após edição** | Backfill anterior só cobriu casos com `installment_key` preenchido. Casos com `installment_key=NULL` (legado, só `installment_number`), `entrada_2/3` em multi-entrada, ou divergências < 1 centavo — ficaram de fora. |
| **B. Sistema permite confirmar a mesma parcela 2× ou 3×** | `manualPaymentService.confirm` não verifica se já existe baixa confirmada para o mesmo `agreement_id + installment_key/number`. Resultado: `totalPaid` infla e o acordo pode ser marcado `completed` incorretamente. |
| **C. Operador não percebe que o valor pode ser editado pelo admin** | Sem feedback visual no diálogo do operador quando o valor digitado difere do agendado (alerta amarelo já foi adicionado na rodada anterior, mas vamos reforçar no fluxo do admin também). |

### Correção (3 frentes)

#### 1. Bloquear baixa duplicada da mesma parcela

Em `manualPaymentService.create` e `manualPaymentService.confirm`:
- Antes de criar/confirmar, fazer `SELECT` por `agreement_id + installment_key (ou installment_number)` com `status='confirmed'`. Se existir → bloquear com mensagem clara: *"Esta parcela já tem uma baixa confirmada (R$ X,XX em DD/MM). Para alterar o valor, use o botão de editar (lápis) na linha da baixa existente."*
- Mesmo bloqueio na UI: em `ManualPaymentDialog`, ao abrir, buscar baixas confirmadas para a parcela e mostrar aviso/desabilitar.

Isso resolve o que Bárbara fez (ela criou uma 2ª baixa pra "forçar" o valor a aparecer — esse caminho deixa de existir).

#### 2. Garantir que **editar o valor** (lápis) realmente sincroniza — tornar `syncInstallmentValueFromPayment` mais robusto

Em `agreementService.syncInstallmentValueFromPayment`:
- Quando `installment_key` for NULL, derivar a chave a partir de `installment_number` (`"entrada"` se 0, senão `String(installment_number)`).
- Tolerância de 1 centavo já existe. Acrescentar log estruturado quando não conseguir resolver a parcela.
- Quando `entrada_value` for atualizado (entrada única), atualizar **também** `custom_installment_values["entrada"]` (para o `buildInstallmentSchedule` ler de qualquer lugar).

#### 3. Backfill segundo round + limpeza de duplicatas

Migration one-shot:
- **Sync round 2**: para todas as `manual_payments` confirmed onde `amount_paid` ainda diverge da parcela agendada (incluindo `installment_key=NULL` e `entrada_2/3`), gravar em `custom_installment_values[chave_resolvida]`. ~9 registros estimados.
- **Reverter duplicatas**: para os 20+ acordos com 2-3 baixas confirmadas no mesmo `installment_key`, **manter a mais recente como `confirmed`** e marcar as anteriores como `superseded` (novo status, ou `rejected` com `review_notes='Substituída por baixa posterior — duplicidade'`). Recalcular `clients.valor_pago` (decrementar a diferença) e re-avaliar `agreements.status` (pode voltar de `completed` para `pending` se overpayment for desfeito).
- Dry-run primeiro: imprimir lista dos 20 acordos + delta de valor antes de executar.

### Arquivos alterados

- `src/services/manualPaymentService.ts` — adicionar guard contra duplicidade em `create` e `confirm`.
- `src/services/agreementService.ts` — `syncInstallmentValueFromPayment` mais robusto (resolve key por number quando NULL; sincroniza `custom_installment_values["entrada"]` quando atualiza `entrada_value`).
- `src/components/acordos/ManualPaymentDialog.tsx` — query de baixas existentes da parcela; aviso/bloqueio quando já houver baixa confirmada; botão alternativo "Editar baixa existente" levando ao admin.
- `src/components/acordos/PaymentConfirmationTab.tsx` — exibir badge "duplicada" caso o backfill tenha marcado, e chamar a versão melhorada do sync.
- Migration SQL one-shot:
  - Sync round 2 para amount_paid divergente.
  - Marcar duplicatas como `superseded` + reverter `valor_pago` e revalidar status do acordo.

### Validação pós-deploy

1. Abrir acordo da Ezi (`3fee4f9c`) → parcela 1 mostra R$ 251,99 (já está correto), e o histórico mostra apenas **uma** baixa confirmada (a outra fica como "Substituída").
2. Abrir acordo `6905fbe5` (Jaciele) → de 1.400 voltou para 700, parcela 1 = R$ 700,01.
3. Operador tenta solicitar baixa de uma parcela já paga → diálogo bloqueia com mensagem clara apontando para a baixa existente.
4. Admin edita valor de baixa via lápis → parcela atualiza imediatamente na tela do detalhe do acordo (mesmo para acordos legados sem `installment_key`).
5. `client_events` recebe evento `manual_payment_superseded` para cada duplicata revertida (auditoria).

### Fora de escopo

- Refazer histórico de auditoria das baixas duplicadas anteriores ao deploy.
- Mexer no fluxo de cobranças PIX/boleto da Negociarie (divergência por juros lá segue caminho diferente).
- Permitir múltiplas baixas parciais na mesma parcela (não é o caso atual — sempre uma baixa = parcela inteira). Se o cliente quiser esse fluxo, pode ser próxima rodada.

