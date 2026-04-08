

# Acordos por Mês de Vencimento das Parcelas

## Contexto

Hoje a página /acordos filtra por `created_at` (data de criação do acordo) e usa o status global do acordo (pending, approved, overdue, etc). O pedido é mudar para filtrar pelo **mês de vencimento das parcelas**, determinando a aba correta com base no status daquela parcela específica.

## Lógica Proposta

Ao selecionar Abril/2026, o sistema calcula quais parcelas de quais acordos vencem em abril e classifica:

- **Pagos**: parcela do mês já quitada (via cobrança paga, manual_payment confirmado, ou payment_confirmed event)
- **Vigentes**: parcela do mês ainda não venceu e não está paga
- **Vencidos**: parcela do mês já passou da data e não foi paga
- **Cancelados**: acordo com status `cancelled`
- **Aguardando Liberação**: acordo com status `pending_approval`
- **Confirmação de Pagamento**: parcela com manual_payment `pending_confirmation`

## Dados Necessários

Além dos agreements, precisamos carregar:
1. **negociarie_cobrancas** — contém `installment_key` e `status` (pago/pendente/vencido)
2. **manual_payments** — contém `agreement_id`, `installment_number`, `status`

Esses dados serão buscados em batch ao carregar a página (2 queries adicionais).

## Implementação

### Arquivo: `src/pages/AcordosPage.tsx`

1. **Buscar dados complementares** no `load()`:
   - `negociarie_cobrancas` com `agreement_id` dos acordos carregados
   - `manual_payments` com `agreement_id` dos acordos carregados

2. **Função `getInstallmentForMonth(agreement, month, year)`**:
   - Calcula todas as parcelas (entrada + parcelas regulares) usando `first_due_date`, `entrada_date`, `custom_installment_dates`, `addMonths`
   - Retorna a parcela cujo vencimento cai no mês/ano selecionado (ou null)

3. **Função `getInstallmentStatus(agreement, installment, cobrancas, manualPayments)`**:
   - Verifica cobrança associada (`installment_key = agreementId:numero`)
   - Verifica manual_payment confirmado ou pending_confirmation
   - Calcula pagamento por waterfall (como já faz o AgreementInstallments)
   - Retorna: `pago`, `vigente`, `vencido`, `pending_confirmation`

4. **Substituir filtro `filteredAgreements`**:
   - Se mês/ano selecionado: filtra apenas acordos que têm parcela naquele mês e classifica pelo status da parcela
   - Se "todos os meses": mantém comportamento por status global do acordo
   - Abas `cancelled` e `pending_approval` continuam usando status global (não dependem de parcela)

5. **Filtros de data (De/Até)**: passam a considerar `first_due_date` ao invés de `created_at`

### Interface Agreement — campos adicionais

Adicionar ao tipo `Agreement` os campos que já existem no banco mas não estão no tipo:
- `custom_installment_dates`
- `custom_installment_values`
- `entrada_date`

## Impacto em Outras Rotas

- **Dashboard** (`get_dashboard_vencimentos`, `get_dashboard_stats`): RPCs independentes, sem impacto
- **Carteira**: usa status do `clients`, sem impacto
- **auto-expire-agreements**: Edge Function independente, sem impacto
- **AgreementInstallments** (detalhe do cliente): componente isolado, sem impacto
- **manualPaymentService**: sem alteração

A mudança é 100% isolada no `AcordosPage.tsx` e no tipo `Agreement`.

## Resultado

| Cenário | Aba |
|---------|-----|
| Parcela de abril paga (Jaciele) | Pagos |
| Parcela de abril ainda não venceu (Renato, 5 restantes) | Vigentes |
| Parcela de abril vencida sem pagamento | Vencidos |
| Acordo cancelado | Cancelados |
| Acordo fora dos termos do credor | Aguardando Liberação |
| Operador fez baixa, admin não confirmou | Confirmação de Pagamento |

