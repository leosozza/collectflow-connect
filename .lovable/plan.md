

# Remover Coluna "Ações" da Lista de Acordos

## Alteração

Remover toda a lógica da coluna "Ações" do componente `AgreementsList.tsx`, já que aprovar, rejeitar e quebrar acordo acontecem nas abas específicas.

## Mudanças

### `src/components/acordos/AgreementsList.tsx`
- Remover props: `isAdmin`, `onApprove`, `onReject`, `onCancel`, `onBreak`, `showOperationalActions`
- Remover a `<TableHead>` de "Ações"
- Remover a `<TableCell>` com os botões (Aprovar, Rejeitar, Quebrar)
- Remover os `AlertDialog` de cancelar e quebrar acordo
- Remover states `cancelId` e `breakId`
- Manter apenas: `agreements` (lista) e a navegação ao clicar no nome do cliente

### Componentes que usam `AgreementsList`
Atualizar todas as chamadas para remover as props removidas (provavelmente em `AcordosPage.tsx` e possivelmente no perfil do cliente).

