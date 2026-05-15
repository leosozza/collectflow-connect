## Objetivo
Quando o Maxlist informar pagamento de um cliente com **acordo vigente/atrasado**, o sistema **não** dá baixa automática. Cria um **alerta de conciliação** na próxima parcela em aberto do acordo, para o operador analisar, ajustar e enviar para confirmação do admin.

## Decisões confirmadas
1. **Parcela alvo:** menor `installment_number` com `paid=false` no acordo ativo.
2. **Match:** apenas por `CPF + credor_id`.
3. **Múltiplos pagamentos:** 1 alerta por pagamento Maxlist, idempotência via `maxlist_source_ref`.
4. **Permissão (fluxo C — híbrido):**
   - **Operador:** abre o alerta, ajusta o acordo, cancela boleto Rivo se houver, registra a baixa manual e marca como "Pronto para confirmação".
   - **Admin/Financeiro:** recebe na fila de **Confirmação de Pagamento** existente e aprova/rejeita a baixa.

## Fluxo

```text
Maxlist sync → clients.status = 'pago' (parcela original)
        ↓
   Existe agreement ativo (vigente/atrasado) p/ CPF+Credor?
        ↓ Sim
   Cria agreement_reconciliation_alerts
   apontando para a próxima parcela em aberto
        ↓
   UI da parcela: badge "⚠ Conciliação pendente"
        ↓
   Operador abre alerta → ajusta acordo / cancela boleto
   → registra baixa manual (manual_payments com
      payment_status='pending_confirmation',
      payment_source='maxlist_reconciled')
   → marca alerta como 'pending_admin_approval'
        ↓
   Admin aprova na fila de Confirmação de Pagamento
   → manual_payments aprovado → SSOT atualiza acordo
   → alerta marcado 'resolved_confirmed'
```

## Mudanças

### 1. Tabela nova: `agreement_reconciliation_alerts`
Campos de domínio:
- `agreement_id`, `installment_id` (parcela alvo)
- `tenant_id`, `client_cpf`, `credor_id`
- `maxlist_payment_value`, `maxlist_payment_date`
- `maxlist_source_ref` (id da linha em `clients` ou batch import — chave de idempotência)
- `status`: `pending` | `pending_admin_approval` | `resolved_confirmed` | `resolved_ignored`
- `linked_manual_payment_id` (preenchido quando operador cria a baixa)
- `assigned_operator_id`, `resolved_by`, `resolved_at`, `resolution_notes`
- Índice único `(agreement_id, maxlist_source_ref)` para idempotência
- RLS por `tenant_id` via `get_my_tenant_id()`

### 2. Edge `maxlist-import` — bridge
Após atualizar `clients.status='pago'`:
- Buscar `agreements` com status `vigente`/`atrasado` para CPF+Credor.
- Se existir → identificar próxima parcela `paid=false` (menor `installment_number`).
- INSERT em `agreement_reconciliation_alerts` com `ON CONFLICT DO NOTHING` (idempotente).
- **Não** mexe em `agreement_installments`/`manual_payments`.

### 3. UI — Tela do Acordo (`/carteira/:cpf?tab=acordo`)
- Badge laranja "⚠ Conciliação pendente" na parcela alvo.
- Modal com:
  - Valor pago no Maxlist + data + origem
  - Valor da parcela do acordo + diferença
  - Histórico de pagamentos Maxlist deste acordo
  - Ações do operador:
    - **Ajustar acordo** (abre fluxo padrão de edição)
    - **Cancelar boleto Rivo** (se existir cobrança ativa)
    - **Registrar baixa manual** (cria `manual_payment` em `pending_confirmation` linkado ao alerta)
    - **Enviar para confirmação** (alerta vira `pending_admin_approval`)
    - **Ignorar alerta** (apenas se não for pagamento real — registra motivo)

### 4. Fila de Confirmação de Pagamento (já existente)
- Os `manual_payments` criados via alerta entram na fila normal do admin.
- Adicionar tag visual "Origem: Maxlist (conciliação)" e link de volta ao alerta.
- Aprovação do admin → trigger SSOT atualiza acordo + marca alerta `resolved_confirmed`.

### 5. Indicador na lista de Acordos (`/acordos`)
- Badge contador "N alertas de conciliação pendentes" para priorização.
- Filtro "Com alerta de conciliação".

### 6. Auto-status-sync
Sem mudanças. Como não criamos baixa automática, o status do acordo permanece correto até o admin aprovar.

## Detalhes técnicos
- Tabela e RLS via migration; índice único `(agreement_id, maxlist_source_ref)`.
- Edge `maxlist-import` ganha bloco de bridge após o UPDATE de `clients.status`.
- Hook React `useReconciliationAlerts(agreementId)` consultando `agreement_reconciliation_alerts`.
- Componente `<ReconciliationAlertModal>` reutilizando o fluxo de baixa manual existente.
- `manual_payments.payment_source` ganha valor `'maxlist_reconciled'` e coluna opcional `reconciliation_alert_id`.
- Memória nova: regra do alerta como SSOT do fluxo de conciliação Maxlist.
