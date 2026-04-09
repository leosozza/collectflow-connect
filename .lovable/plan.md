

# Remover Badge "Boleto pendente" da Lista de Acordos

## Problema
O badge "Boleto pendente" continua aparecendo na página `/acordos`. A edição anterior não foi salva.

## Alteração

### `src/components/acordos/AgreementsList.tsx`
- Linhas 69-78: Simplificar a célula de Status removendo o `<div>` wrapper e o badge "Boleto pendente"
- Substituir por apenas: `<Badge className={...}>{statusLabels[a.status] || a.status}</Badge>`

