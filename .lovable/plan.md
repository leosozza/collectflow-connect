## Caso de referência

Giselly Barbosa Xavier (CPF 559.821.528-46) — contrato Maxlist 763936:
- Parcelas 1-9: pagas no Maxsystem (várias com "Temis Cobrança"), valores R$ 91,82.
- Parcelas 10, 11, 12: ainda boleto em aberto.
- Acordo Rivo `272f4eb9`: 3x R$ 133,32, parcela 1 paga via Negociarie.

O alerta veio porque a parcela 8 do Maxlist mudou para "pago" em 18/05. Mas no Maxsystem a parcela 8 já estava `em_acordo` antes — alguém só registrou a baixa manualmente, espelhando o que o Rivo já recebeu. Não é pagamento novo; não deveria virar alerta.

## Regra de negócio (definição do usuário)

Só gerar aviso quando **as duas condições** forem verdadeiras:

1. O cliente pagou um **boleto real do Maxsystem** — parcela que estava em aberto (`pendente` ou `vencido`), com valor igual ao boleto original, mudou para `pago`. Baixas que partem de `em_acordo` (espelho do que o Rivo já recebeu) **não geram alerta**.
2. O mesmo cliente tem **acordo ativo no Rivo** para o mesmo credor.

O aviso é **informativo**, em nível de acordo — não vincula parcela a parcela. Mostra "Cliente pagou R$ X no Maxsystem em DD/MM — verifique se interfere neste acordo".

## Plano de correção

### 1. Endurecer o gatilho na importação Maxlist

`supabase/functions/maxlist-import/index.ts` — ao acumular `paidPaymentsForReconciliation` (linhas 672-690), filtrar pelo **status anterior** do registro:

- Push só quando `p.existing.status IN ('pendente','vencido')` **e** o novo `status='pago'`.
- Pular quando `p.existing.status='em_acordo'` (é só espelho da baixa do Rivo no Maxsystem).
- Pular quando `p.existing.status` já era `pago` (revalidação/reprocessamento).

### 2. Reescrever `create_reconciliation_alerts_from_maxlist`

Manter assinatura, mudar comportamento:

- Localizar acordo Rivo ativo (`approved` ou `overdue`) do par CPF + Credor — igual hoje.
- **Não** procurar parcela específica nem vincular `installment_id`/`installment_key`. Salvar como `NULL`.
- Idempotência continua por `(agreement_id, maxlist_source_ref)`.
- Skip extra: se o valor do pagamento Maxlist é compatível (±R$ 1) com alguma parcela já paga do acordo Rivo nos últimos 7 dias via Negociarie/portal/manual confirmado → não criar alerta (a baixa espelho que escapou do filtro do passo 1 ainda fica coberta).

### 3. UI — `ReconciliationAlertModal` vira aviso informativo

- Título: "Pagamento detectado no Maxsystem".
- Remover bloco "Valor da parcela" e o cálculo "Faltam R$ X" — não há vínculo de parcela.
- Mostrar: valor pago, data, contrato Maxlist (`cod_contrato`), parcela original (`numero_parcela`) e nome do credor.
- Mensagem: "O Maxsystem registrou este pagamento como boleto liquidado. Verifique se ele já consta neste acordo (via Negociarie/portal/baixa manual). Se sim, marque como reconhecido. Se não, registre a baixa manual."
- Duas ações:
  - **"Já reconhecido neste acordo"** (substitui "Ignorar alerta") → marca `resolved_ignored`.
  - **"Registrar baixa manual"** → abre `ManualPaymentDialog` (operador escolhe qual parcela do acordo receber a baixa).

Como o alerta deixa de ter `installment_id`/`installment_key`, ajustar onde aparece (`AgreementInstallments.tsx`) para exibir o aviso uma vez por acordo (badge no topo), e não dentro de uma parcela específica.

### 4. Backfill — limpar alertas legados

Migração com `UPDATE` único marcando `resolved_ignored` (notes='auto: regra atualizada — baixa espelho do Rivo no Maxsystem') todos alertas com status `pending`/`pending_admin_approval` onde o registro Maxlist de origem (`maxlist_source_ref` = `clients.id`) tinha status anterior `em_acordo`. Para fazer isso preciso de uma coluna ou heurística — como não armazenamos o status anterior, uso fallback: marcar resolvidos todos os alertas atualmente abertos cujo acordo já tenha pelo menos uma parcela paga via Negociarie/portal/manual confirmado nos ±7 dias do `maxlist_payment_date`.

O caso Giselly será limpo por essa regra.

### 5. Memória

Atualizar `mem://features/maxlist/reconciliation-alerts` com as novas condições (status anterior + acordo ativo, aviso em vez de vínculo parcela-a-parcela, novos rótulos da UI).

## Detalhes técnicos

**Arquivos**
- `supabase/functions/maxlist-import/index.ts` — adicionar filtro `existing.status IN ('pendente','vencido')` antes do push.
- Migração: redefinir `create_reconciliation_alerts_from_maxlist` (sem vínculo de parcela + skip por baixa Rivo recente) + UPDATE de backfill.
- `src/components/acordos/ReconciliationAlertModal.tsx` — novo título, sem cálculo de diferença, novos botões, novo texto.
- `src/components/client-detail/AgreementInstallments.tsx` — mover o badge do alerta de "por parcela" para "por acordo" (topo da lista).
- `src/services/reconciliationAlertService.ts` — sem mudanças funcionais.

**Sem alterações**
- RLS, tabela `agreement_reconciliation_alerts` (já aceita `installment_id` nullable), fluxo de `manual_payments`.

## Validação após implementação

1. Reimportar o lote do CPF 559.821.528-46 → nenhum alerta novo (parcela 8 partia de `em_acordo`).
2. Simular cliente com acordo Rivo + boleto Maxlist real liquidado (parcela `pendente`→`pago`) → 1 alerta criado, sem vínculo de parcela.
3. Modal: ações renomeadas, sem "Faltam R$ X".
4. Backfill: alerta da Giselly aparece `resolved_ignored`.
