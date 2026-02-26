

## Plano: Editar/Cancelar Acordo + Excluir cancelados das métricas + Status "Quebra de Acordo"

### 1) Botões "Editar" e "Cancelar" na AgreementsList

**Arquivo: `src/components/acordos/AgreementsList.tsx`**
- Adicionar props `onEdit` e coluna "Ações" visível para todos (não só admin)
- Botão **Editar** (ícone Pencil): visível para acordos `pending`, `pending_approval` e `approved`
- Botão **Cancelar** (ícone Trash2): com `AlertDialog` de confirmação, visível para acordos ativos (`pending`, `pending_approval`, `approved`)
- Remover restrição `isAdmin` para exibir ações — todos podem ver, mas manter `isAdmin` para Aprovar/Rejeitar

### 2) Função de edição

**Arquivo: `src/services/agreementService.ts`**
- Criar `updateAgreement(id, data: Partial<AgreementFormData>)` que faz `update` no registro

**Arquivo: `src/pages/AcordosPage.tsx`**
- Adicionar estado `editingAgreement` e dialog de edição (reutilizar campos do AgreementForm)
- Passar `onEdit` para `AgreementsList`

### 3) Cancelamento marca parcelas como "quebrado"

**Arquivo: `src/services/agreementService.ts`**
- Na função `cancelAgreement`: além de setar `status: "cancelled"`, atualizar as parcelas pendentes do CPF/credor na tabela `clients` para `status: "quebrado"` (não voltar para "aguardando acionamento")

### 4) Excluir acordos cancelados das métricas

**Arquivo: `src/pages/DashboardPage.tsx`**
- No `agreementCpfs`, filtrar: `agreements.filter(a => a.status !== "cancelled" && a.status !== "rejected")`
- Nos contadores `acordosDia` e `acordosMes`, excluir cancelados

**Arquivo: `src/pages/RelatoriosPage.tsx`**
- No `allAgreementCpfs` e `agreementDerivedStatus`, ignorar agreements com `status === "cancelled"`

**Arquivo: `src/pages/AcordosPage.tsx`**
- Nos StatCards (Total de Acordos, Pendentes, Aprovados, Valor Renegociado), excluir `cancelled` e `rejected` da contagem

### 5) Detalhes técnicos
- O cancelamento de acordo aprovado muda parcelas pendentes para "quebrado" na tabela `clients`, mantendo o histórico
- Acordos `cancelled`/`rejected` são excluídos de todas as métricas (Dashboard, Relatórios, Analytics)
- A edição só permite alterar campos antes da aprovação final (valores, parcelas, datas)

