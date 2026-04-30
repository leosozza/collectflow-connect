
# Abater pagamentos de acordos quebrados em renegociações (apenas novos casos)

## Problema

Quando um acordo é cancelado/quebrado, as baixas confirmadas (em `manual_payments` e `negociarie_cobrancas`) ficam órfãs: continuam vinculadas ao acordo antigo, mas **não voltam** para o saldo da dívida original em `clients.valor_pago`. Resultado: ao renegociar, o `AgreementCalculator` calcula a proposta sobre o saldo cheio, ignorando o que o cliente já pagou.

## Escopo

- **Sem backfill.** Os 8 casos antigos (Y.BRASIL / TESS MODELS) **não serão alterados**. Os operadores continuarão fazendo o estorno manualmente nesses acordos.
- A nova regra vale **somente para cancelamentos a partir do deploy**.
- Cada abatimento será **claramente rotulado como vindo de um acordo anterior**, com rastreabilidade no banco e na UI.

## Mudanças

### 1. Migration — coluna de rastreabilidade

```sql
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS valor_pago_origem jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clients.valor_pago_origem IS
  'Histórico de origem dos pagamentos abatidos. Cada entrada:
   { source: "agreement_credit"|"direct", source_agreement_id, amount, applied_at, applied_by, note }';
```

`valor_pago` continua sendo o total numérico (única fonte para o calculator). `valor_pago_origem` apenas documenta de onde veio cada parcela do crédito.

### 2. Backend — `src/services/agreementService.ts`

**Nova função `creditPaymentsToOriginalDebt`** (não exportada para uso direto fora do service):

- Recebe `cpf, credor, totalCredit, tenantId, sourceAgreementId, breakdown`.
- Distribui FIFO por `data_vencimento` nas parcelas `clients` `status = 'pendente'` (mesmo CPF + credor + tenant).
- Para cada `clients` atualizado:
  - Soma em `valor_pago`.
  - Faz `append` em `valor_pago_origem` com `{ source: "agreement_credit", source_agreement_id, amount, applied_at, applied_by, note: "Abatimento de acordo quebrado" }`.
  - Se atingir o valor da parcela, marca `status = 'pago'` e `data_quitacao`.
- Se sobrar crédito (sem parcela pendente para abater), registra `client_events` `credit_overflow` (admin decide manualmente — não cria crédito automático).

**Ajuste em `cancelAgreement`** (linha ~519):

Após `update agreements set status='cancelled'` e antes do bloco que reverte status dos `clients`:

1. Calcular total recebido **somente deste acordo cancelado**:
   - `manual_payments.amount_paid` onde `agreement_id = id` e `status = 'confirmed'`
   - `negociarie_cobrancas.valor_pago` onde `agreement_id = id` e `status = 'pago'`
2. **Idempotência**: checar `client_events` se já existe `previous_agreement_credit_applied` com `metadata->>source_agreement_id = id`. Se sim, abortar este passo (já creditado).
3. Se `totalRecebido > 0`, chamar `creditPaymentsToOriginalDebt(...)`.
4. Inserir `client_events`:
   ```
   event_type: "previous_agreement_credit_applied"
   event_source: "operator"
   metadata: {
     source_agreement_id, total_credited,
     breakdown: { manual: X, negociarie: Y },
     applied_to_titles: [ { client_id, amount } ]
   }
   ```
5. Inserir `audit_logs` (`action: "previous_agreement_credit"`, `entity_type: "agreement"`, `entity_id: id`).

A reversão de status dos `clients` que já existe (linhas 569-624) continua **depois** do crédito — assim, parcelas totalmente quitadas pelo crédito ficam `pago` em vez de voltarem para `pendente`.

### 3. UI — `src/components/acordos/AgreementCalculator.tsx`

Antes de renderizar o calculator, buscar via `clients` se algum título do CPF+credor tem `valor_pago_origem` contendo entrada com `source = 'agreement_credit'`:

- **Banner azul informativo no topo:**
  > "Este cliente já pagou R$ X,XX em acordos anteriores que foram quebrados. Esse valor já foi abatido do saldo abaixo."
- **Tooltip no Saldo Devedor** com lista detalhada:
  > Acordo #abc12345 quebrado em 12/03/2026 — R$ 200,00
  > Acordo #def67890 quebrado em 05/04/2026 — R$ 150,00

Não muda o cálculo (ele já lê `valor_parcela - valor_pago`); apenas torna o abatimento visível ao operador.

### 4. UI — `src/components/atendimento/ClientTimeline.tsx`

Adicionar render para `event_type = "previous_agreement_credit_applied"`:
> "Crédito de acordo anterior aplicado — R$ X,XX (acordo #abc12345 quebrado em DD/MM/AAAA)"

Ícone neutro (azul), distinto de pagamentos diretos.

### 5. Documentação

Atualizar `mem://logic/acordos/reconciliacao-pagamentos` com a nova regra: "Cancelamento de acordo com pagamentos confirmados gera crédito automático na dívida original via `valor_pago` + rastro em `valor_pago_origem`. Aplica-se somente a cancelamentos pós-deploy desta regra."

## Arquivos afetados

- `supabase/migrations/<timestamp>_clients_valor_pago_origem.sql` — nova coluna.
- `src/services/agreementService.ts` — nova função `creditPaymentsToOriginalDebt`, ajuste em `cancelAgreement`.
- `src/components/acordos/AgreementCalculator.tsx` — banner + tooltip.
- `src/components/atendimento/ClientTimeline.tsx` — render do novo evento.
- `mem://logic/acordos/reconciliacao-pagamentos` — atualização da regra.

## Validação pós-deploy

1. Em ambiente de teste: criar acordo, confirmar baixa manual de uma parcela, cancelar o acordo.
2. Conferir em `clients`: o `valor_pago` da parcela mais antiga aumentou e `valor_pago_origem` contém a entrada com `source_agreement_id` correto.
3. Abrir o `AgreementCalculator` para o mesmo CPF/credor: banner azul aparece, saldo já vem reduzido.
4. Conferir `client_events` e `audit_logs`: evento e log gerados.
5. Cancelar o mesmo acordo de novo (cenário absurdo, mas testa idempotência): nada novo deve ser creditado.

## Risco

Baixo. Mudança aditiva (coluna nova, função nova, eventos novos). Nada toca dados históricos. Nenhum dos 8 acordos antigos é alterado — o estorno deles continua manual, conforme decidido.
