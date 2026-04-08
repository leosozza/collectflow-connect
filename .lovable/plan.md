

# Fix: Status de Acordos Não Atualiza Após Baixa Manual + Filtros de Data

## Problemas Identificados

### 1. Evento de pagamento manual invisível ao motor de status
A Edge Function `auto-expire-agreements` busca apenas eventos `payment_confirmed`, mas a baixa manual gera `manual_payment_confirmed`. O pagamento da Jaciele nunca é contabilizado.

### 2. Campo de valor incompatível
Mesmo se o evento fosse encontrado, o motor lê `metadata.valor_pago` mas o evento manual grava `metadata.amount_paid`. Resultado: valor = 0.

### 3. Acordo nunca é marcado como "Pago" (approved)
Nem a `registerAgreementPayment()` nem a `auto-expire-agreements` atualizam o status do **acordo** para `approved` quando o valor total é quitado. Só a tabela `clients` é atualizada.

## Correções

### A. `manualPaymentService.ts` — Atualizar acordo ao confirmar pagamento
Após chamar `registerAgreementPayment()`, verificar se o total pago (via `manual_payments` confirmados + `negociarie_cobrancas` pagas + eventos `payment_confirmed`) cobre o `proposed_total` do acordo. Se sim, atualizar `agreements.status = 'approved'`.

### B. `auto-expire-agreements/index.ts` — Incluir pagamentos manuais
1. Buscar eventos com `event_type IN ('payment_confirmed', 'manual_payment_confirmed')`
2. Ler o valor de `metadata.valor_pago` OU `metadata.amount_paid` (coalesce)
3. Incluir `manual_payments` confirmados na contagem de pagamento total
4. Marcar acordos como `approved` quando totalmente pagos

### C. `AcordosPage.tsx` — Adicionar filtros de mês/ano e período
Adicionar filtros de Mês, Ano e seleção de datas (De/Até) no padrão já usado no sistema (similar ao `ReportFilters`), filtrando por `created_at` dos acordos.

## Arquivos Alterados
- `supabase/functions/auto-expire-agreements/index.ts` — incluir `manual_payment_confirmed` + marcar `approved`
- `src/services/manualPaymentService.ts` — atualizar status do acordo para `approved` se quitado
- `src/pages/AcordosPage.tsx` — adicionar filtros de data (mês, ano, período)

## Resultado Esperado
- Jaciele e Renato aparecerão na aba "Pagos" após a correção
- O motor de status reconhecerá pagamentos manuais confirmados
- Filtros de data permitirão visualizar acordos por período específico

