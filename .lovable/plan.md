

## Diagnóstico — Edição de valor em "Confirmação de Pagamento" não reflete no acordo/carteira

### Dados do caso (Kemilly — CPF 44013503832, acordo `e66340e7...`)

Acordo: entrada R$ 144,00 + 2x R$ 135,95 = **proposed_total R$ 415,90**.

Manual payments confirmados (4 baixas):
| installment_key | installment_number | amount_paid | status |
|---|---|---|---|
| `entrada` | 0 | **136,36** | confirmed (edição antiga) |
| `2` | 2 | **136,36** | confirmed (edição antiga) |
| `null` | 0 | **144,42** | confirmed (admin editou o valor) |
| `null` | 2 | **136,36** | confirmed |

**Total em manual_payments: R$ 553,50** (valor correto que ADMIN validou).
**Total distribuído em `clients` (carteira): R$ 1.798,36** (12 parcelas de R$ 136,xx marcadas "pago").
→ Discrepância enorme. O que o admin editou **foi** aplicado na tabela `manual_payments` (a cópia auditada), mas a distribuição em `clients` pegou carona com o acordo original (12 parcelas geradas na Carteira sem relação com o acordo atual).

### Causa-raiz

`PaymentConfirmationTab.handleEdit` (linha 60-84) atualiza SÓ a linha em `manual_payments`. Não há:

1. **Revalidação/ajuste da distribuição em `clients`**: se o pagamento já foi confirmado (`confirmed`) quando o admin edita, os valores em `clients.valor_pago` ficam congelados com o que `registerAgreementPayment` aplicou na confirmação original. Editar depois **não reexecuta** a distribuição.
2. **Sem ajuste no `agreements.custom_installment_values`**: o valor da parcela no acordo continua com `135,95` (ou `144` na entrada), mesmo o admin tendo decidido que a baixa "vale" outro valor.
3. **Sem checagem de completude**: se a edição muda o valor total pago e faz `sum >= proposed_total`, o acordo deveria virar `completed`. Se diminui, deveria reverter. Nada disso acontece.

Além disso, no caso da Kemilly há um problema colateral: a carteira (`clients`) tem **12 parcelas de R$ 136,xx** (total ~R$ 1.798) que não correspondem ao acordo atual de R$ 415,90 — parecem ter sido geradas por um fluxo anterior e `registerAgreementPayment` distribuiu as baixas sequencialmente quitando-as todas. Isso é um bug paralelo de distribuição (dados legados/desalinhados), mas o sintoma que o admin vê — "editei e o acordo não atualizou" — é o bug #1.

### Correção (cirúrgica)

Tornar `handleEdit` transacional e consistente com o fluxo de confirmação:

**Arquivo**: `src/components/acordos/PaymentConfirmationTab.tsx` (função `handleEdit`)

Nova lógica:
1. Buscar o payment atual antes do update para saber `oldAmount` e `status`.
2. Aplicar o UPDATE em `manual_payments` (já faz).
3. **Se status === "confirmed"** (edição pós-confirmação): calcular delta = `newAmount - oldAmount` e chamar `registerAgreementPayment(cpf, credor, delta)` para aplicar diferença em `clients` (positiva distribui mais, negativa precisa de reversão — ver item abaixo).
4. **Se status === "pending_confirmation"**: só atualiza `manual_payments` (ainda não foi aplicado na carteira) — comportamento atual está correto.
5. Recalcular `total pago consolidado` (soma de `manual_payments.confirmed` + `negociarie_cobrancas.pago`) e:
   - Se `total >= proposed_total` → `agreements.status = "completed"` e `clients.status = "pago"`.
   - Se `total < proposed_total` e acordo estava `completed` → reverter para `pending` (voltar ao estado em andamento).
6. Registrar `client_event` (`manual_payment_edited`) com `old_amount` / `new_amount` para auditoria e aparecer no Histórico.

**Delta negativo (redução de valor)**: criar helper `reverseAgreementPayment(cpf, credor, valor)` em `agreementService.ts` que percorre títulos `pago` do mais recente para o mais antigo, subtrai `valor_pago` e reverte `status` para `pendente` + limpa `data_quitacao` quando `valor_pago < valor_parcela`.

### Escopo

**Arquivos alterados:**
- `src/components/acordos/PaymentConfirmationTab.tsx` — reescrita do `handleEdit` (~40 linhas).
- `src/services/agreementService.ts` — adiciona `reverseAgreementPayment` (~30 linhas).

### Fora do escopo (será tratado separadamente se você pedir)

- Correção dos dados legados da Kemilly (12 parcelas R$ 136,xx na Carteira que não batem com o acordo atual de R$ 415,90) — isso exige análise caso a caso e migração de dados manual, não é um fix de código.
- Schema, RLS, outras abas.

### Sem alteração
- Fluxo de criação/confirmação/rejeição de manual_payments (já funciona).
- `AgreementInstallments` UI inline.
- Qualquer edge function.

