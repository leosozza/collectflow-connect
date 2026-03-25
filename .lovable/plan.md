

# Plano: Fluxo de Baixa Manual com Confirmação de Pagamento

## Resumo

Criar um fluxo completo de baixa manual de parcelas dentro do módulo Acordos, com aprovação obrigatória por admin, rastreabilidade total e campo `recebedor` (CREDOR/COBRADORA). Sem impactar baixa automática via Negociarie/boletos.

## Arquitetura

```text
Operador → "Baixar Manualmente" (parcela) → Modal com campos obrigatórios
  ↓
Registro na tabela `manual_payments` (status: pending_confirmation)
  ↓
Admin acessa aba "Confirmação de Pagamento" em /acordos
  ↓
Admin aprova → executa baixa real (clients.status=pago) + contabiliza
Admin recusa → registro fica como recusado, parcela inalterada
```

## Banco de Dados

### Nova tabela: `manual_payments`

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| agreement_id | uuid FK agreements | Acordo vinculado |
| installment_number | int | Número da parcela (0=entrada) |
| amount_paid | numeric | Valor pago informado |
| payment_date | date | Data do pagamento |
| payment_method | text | Meio (PIX, Transferência, Depósito, Dinheiro, Outro) |
| receiver | text | 'CREDOR' ou 'COBRADORA' |
| notes | text | Observação do operador |
| status | text | 'pending_confirmation', 'confirmed', 'rejected' |
| requested_by | uuid FK profiles | Operador que solicitou |
| reviewed_by | uuid FK profiles | Admin que aprovou/recusou |
| reviewed_at | timestamptz | Data da revisão |
| review_notes | text | Observação do admin |
| created_at | timestamptz | |

RLS: tenant isolation + leitura para authenticated do mesmo tenant.

### Alteração na tabela `client_attachments`

Adicionar coluna opcional `manual_payment_id uuid` para vincular comprovantes à baixa manual (sem alterar fluxo existente de anexos).

## Mudanças por Arquivo

### 1. Migração SQL
- Criar tabela `manual_payments` com RLS
- Adicionar coluna `manual_payment_id` em `client_attachments`
- Habilitar realtime (opcional)

### 2. `src/services/manualPaymentService.ts` (NOVO)
- `createManualPayment()` — insere com status `pending_confirmation`
- `fetchPendingConfirmations()` — lista pendentes para admin
- `confirmPayment()` — admin aprova → executa baixa real via `registerAgreementPayment` + atualiza status
- `rejectPayment()` — admin recusa com motivo
- Registra `client_events` e `audit_logs` em cada ação

### 3. `src/components/acordos/ManualPaymentDialog.tsx` (NOVO)
Modal com campos obrigatórios:
- Valor pago (CurrencyInput)
- Data do pagamento (date picker)
- Meio de pagamento (select: PIX, Transferência, Depósito, Dinheiro, Outro)
- Recebedor (select: CREDOR, COBRADORA)
- Observação (textarea)

Sem abertura automática de anexos após salvar.

### 4. `src/components/acordos/PaymentConfirmationTab.tsx` (NOVO)
Tabela listando baixas manuais pendentes com:
- Cliente, CPF, credor, parcela, valor, data, meio, recebedor, operador, data da solicitação
- Botões Aprovar/Recusar (apenas admin)
- Ao aprovar: executa baixa real e registra auditoria
- Ao recusar: solicita motivo e registra

### 5. `src/components/client-detail/AgreementInstallments.tsx`
- Adicionar item "Baixar Manualmente" no DropdownMenu de cada parcela (quando não paga e sem boleto pago)
- Adicionar badge visual "Aguardando Confirmação" quando parcela tem `manual_payment` pendente
- Query para verificar `manual_payments` existentes por agreement_id

### 6. `src/pages/AcordosPage.tsx`
- Adicionar badge/filtro "Confirmação de Pagamento" ao lado dos filtros existentes (Vigentes, Pagos, etc.)
- Quando selecionado, renderiza `PaymentConfirmationTab` ao invés de `AgreementsList`
- Visível apenas para admin/perfil com permissão

### 7. `src/components/relatorios/PrestacaoContas.tsx`
- Adicionar coluna/seção diferenciando:
  - Baixas automáticas (boleto/Negociarie)
  - Baixas manuais confirmadas
  - Pendentes de confirmação
- Exibir campo `recebedor` (CREDOR vs COBRADORA) no relatório
- Totalizar por tipo de recebedor

### 8. Auditoria (`client_events`)
- Ao criar solicitação: evento `manual_payment_requested`
- Ao confirmar: evento `manual_payment_confirmed`
- Ao recusar: evento `manual_payment_rejected`
- Metadata inclui todos os campos (valor, meio, recebedor, operador, aprovador)

## O que NÃO será alterado

- Fluxo de geração de boletos pela Negociarie
- Baixa automática de boletos pagos
- Header do cliente / ClientDetailPage
- Outras abas fora de Acordos
- Módulo de anexos existente (apenas adiciona FK opcional)
- `PaymentDialog` da aba Carteira (completamente separado)

## Ordem de implementação

1. Migração SQL (tabela + RLS)
2. Service layer (`manualPaymentService.ts`)
3. Modal de baixa manual (`ManualPaymentDialog.tsx`)
4. Integração no `AgreementInstallments.tsx`
5. Aba de confirmação (`PaymentConfirmationTab.tsx`)
6. Integração no `AcordosPage.tsx`
7. Atualização da Prestação de Contas

