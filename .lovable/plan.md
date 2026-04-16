

# Editar, Cancelar e Reabrir Acordos no Perfil do Cliente

## Resumo

Três alterações: (1) nova função `reopenAgreement` no service, (2) expandir visibilidade dos botões Editar/Cancelar, (3) trocar o botão "Reativar" para reabrir o acordo existente em vez de criar novo.

## Alterações

### 1. `src/services/agreementService.ts` — nova função `reopenAgreement`

```typescript
export const reopenAgreement = async (id: string, userId: string): Promise<void> => {
  // Busca agreement (cpf, credor, tenant_id)
  // Update status → "pending", limpa cancellation_type
  // Re-marca títulos como "em_acordo" (mesma lógica do createAgreement)
  // Audit log + recalcScoreForCpf
};
```

### 2. `src/pages/ClientDetailPage.tsx` — expandir botões + reabrir

**Linha 61**: Expandir `activeStatuses` para incluir `overdue` no cancelamento, e criar lista separada para edição:
```typescript
const editableStatuses = ["pending", "pending_approval", "approved", "overdue", "cancelled"];
const cancellableStatuses = ["pending", "pending_approval", "approved", "overdue"];
```

**Linhas 375-396**: Reorganizar condicionais dos botões:
- **Editar**: visível se `editableStatuses.includes(status)` e status !== `completed`/`rejected`
- **Cancelar**: visível se `cancellableStatuses.includes(status)`
- **Reabrir**: botão existente para `cancelled` — trocar `handleReactivateAgreement` para chamar `reopenAgreement` com AlertDialog de confirmação, em vez de abrir o formulário de novo acordo

**Novo estado**: `reopenId` para controlar o AlertDialog de reabertura (similar ao `cancelId`).

**Nova função**:
```typescript
const handleReopenAgreement = async (id: string) => {
  await reopenAgreement(id, user.id);
  toast.success("Acordo reaberto com sucesso.");
  refetch(); refetchAgreements();
};
```

**Novo AlertDialog** para confirmação de reabertura (similar ao de cancelamento).

### Arquivos alterados
- `src/services/agreementService.ts`
- `src/pages/ClientDetailPage.tsx`

