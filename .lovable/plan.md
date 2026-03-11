

# Correção: Permitir recebimento em acordos vencidos

## Problema

O array `activeStatuses` na linha 41 de `AgreementsList.tsx` não inclui `"overdue"`, então quando um acordo vence, todos os botões de ação (Aprovar/Receber, Editar, Cancelar) desaparecem.

Além disso, a condição de aprovação (linha 86) só verifica `pending` e `pending_approval`, excluindo `overdue`.

## Correção

Em `src/components/acordos/AgreementsList.tsx`:

1. Adicionar `"overdue"` ao array `activeStatuses` (para Editar e Cancelar)
2. Adicionar `"overdue"` à condição do botão Aprovar/Receber (linha 86)

Resultado: acordos vencidos continuam com botões de Receber, Editar e Cancelar visíveis — permitindo que admin/operador registre o pagamento durante o prazo de tolerância do credor.

| Arquivo | Mudança |
|---|---|
| `src/components/acordos/AgreementsList.tsx` | Incluir `overdue` nas condições de ação |

