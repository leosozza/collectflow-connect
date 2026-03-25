

# Plano: Reorganizar `/acordos` e aba Acordos do perfil do cliente

## Resumo

Transformar `/acordos` em painel de consulta/navegação. Mover toda gestão operacional de acordos e parcelas para a aba "Acordos" do perfil do cliente (`ClientDetailPage`). Eliminar duplicidade.

## Mudanças

### 1. `src/components/acordos/AgreementsList.tsx` — Simplificar para consulta

**Remover**: botões Editar e Cancelar para status Pagos, Vigentes, Vencidos, Cancelados.
**Manter**: botões Aprovar/Rejeitar apenas para "Aguardando Liberação" (admin).
**Adicionar**: coluna "Operador" (join com profiles via `created_by`).
**Adicionar**: link/botão "Ver Perfil" em cada linha que navega para `/clientes/{cpf}?tab=acordo`.

### 2. `src/pages/AcordosPage.tsx` — Remover dialog de edição

**Remover**: `editDialog` completo (o dialog com `AgreementInstallments` embutido).
**Remover**: `handleEditOpen`, `handleEditSubmit`, `editForm`, `editingAgreement` e toda lógica de edição.
**Remover**: import de `AgreementInstallments`, `CurrencyInput`, `Textarea`, `Label`.
**Manter**: `handleApprove`, `handleReject` (necessários para "Aguardando Liberação").
**Manter**: `handleCancel` apenas para admin (cancelar acordo direto).
**Manter**: `PaymentConfirmationTab` para a aba de confirmação de pagamento.

### 3. `src/pages/ClientDetailPage.tsx` — Enriquecer aba "Acordos"

**3a. Buscar nome do operador**: Alterar query de `agreements` para fazer join com `profiles` via `created_by`:
```sql
.select("*, profiles:created_by(full_name)")
```

**3b. Exibir operador/canal** em cada card de acordo:
- Adicionar campo "Operador" mostrando `profiles.full_name` ou "Portal" / "IA WhatsApp" conforme o canal de origem.

**3c. Mostrar parcelas para TODOS os status** (não apenas `approved`):
- Remover condição `agreement.status === "approved"` do `AgreementInstallments`.
- Mostrar para `pending`, `pending_approval`, `approved`, `overdue`.

**3d. Adicionar ao `AgreementInstallments`** (componente compartilhado):
- **Editar valor da parcela**: novo item no DropdownMenu (apenas quando não paga). Abre input inline ou popover para alterar valor. Persiste em `custom_installment_values` (novo campo JSONB no agreements, similar ao `custom_installment_dates`).
- **Baixar recibo**: novo item "Baixar Recibo" no DropdownMenu, visível **apenas quando `status === "pago"`**. Gera/baixa um PDF simples ou link do comprovante.

### 4. `src/components/client-detail/AgreementInstallments.tsx` — Novas funcionalidades

**Adicionar no DropdownMenu**:
- "Editar Valor" (quando não paga e não pending_confirmation)
- "Baixar Recibo" (apenas quando `isPaid === true`)

**Editar valor**: usa `updateInstallmentValue` (nova função no agreementService) que salva em `custom_installment_values` JSONB no agreement, similar a `custom_installment_dates`.

**Baixar recibo**: gera um recibo simples via download (pode ser window.print de um template ou link do boleto pago).

### 5. Migração SQL

Adicionar coluna `custom_installment_values` JSONB ao `agreements` para permitir edição de valores individuais por parcela.

### 6. `src/services/agreementService.ts`

Adicionar função `updateInstallmentValue(agreementId, installmentKey, newValue)` — mesma lógica de `updateInstallmentDate` mas para valores.

### 7. `src/services/agreementService.ts` — fetchAgreements com operador

Alterar select para incluir join com profiles: `"*, profiles:created_by(full_name)"` e mapear `creator_name` no retorno.

## O que NÃO será alterado

- Header do cliente
- Outras abas do perfil
- Fluxo de formalização de acordo (AgreementCalculator)
- Baixa automática de boletos (Negociarie)
- Fluxo de baixa manual com confirmação
- PaymentConfirmationTab (permanece em /acordos)

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/AcordosPage.tsx` | Remover dialog de edição, simplificar |
| `src/components/acordos/AgreementsList.tsx` | Adicionar coluna operador, link perfil, remover editar/cancelar de status de consulta |
| `src/pages/ClientDetailPage.tsx` | Join com profiles, mostrar operador, parcelas para todos status |
| `src/components/client-detail/AgreementInstallments.tsx` | Adicionar editar valor e baixar recibo |
| `src/services/agreementService.ts` | updateInstallmentValue, fetchAgreements com creator |
| Migração SQL | custom_installment_values JSONB |

