

# Restringir "Reabrir Parcelas" por Permissão

## Problema
A função de reabrir parcelas pagas está acessível a qualquer usuário. Deve ser exclusiva de admins ou quem o admin autorizar.

## Solução

Adicionar uma nova action `reopen` ao módulo `carteira` no sistema de permissões existente (`usePermissions`), e condicionar a UI de reabertura a essa permissão.

### 1. `src/hooks/usePermissions.ts`
- Adicionar `"reopen"` às actions de `carteira` para `super_admin` e `admin` nos `ROLE_DEFAULTS` (demais roles **não** recebem)
- Expor `canReopenParcelas: has("carteira", "reopen")` no retorno do hook
- Adicionar `"reopen": "Reabrir Parcelas"` em `ACTION_LABELS`
- Adicionar `"reopen"` em `MODULE_AVAILABLE_ACTIONS.carteira`

### 2. `src/pages/ClientDetailPage.tsx`
- Importar `usePermissions` e extrair `canReopenParcelas`
- Condicionar toda a UI de reabertura (barra de seleção com checkboxes, botão "Reabrir", botão individual com ícone `RotateCcw`) a `canReopenParcelas === true`
- Os diálogos de confirmação permanecem mas só são acionáveis se a permissão existir

### Resultado
- Apenas `super_admin` e `admin` veem a opção por padrão
- O admin pode conceder `reopen` a qualquer outro papel via a tela de Permissões (perfis de permissão já existentes)
- Nenhuma alteração de banco necessária — a permissão é gerida pelo sistema RBAC em memória/RPC já existente

