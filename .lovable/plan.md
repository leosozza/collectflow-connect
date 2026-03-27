

# Plano: Corrigir 404 ao clicar no nome do cliente em /acordos

## Problema
O `AgreementsList.tsx` navega para `/clientes/${cpf}` mas a rota correta é `/carteira/${cpf}`.

## Correção

| Arquivo | Mudança |
|---|---|
| `src/components/acordos/AgreementsList.tsx` | Linha 51: trocar `/clientes/` por `/carteira/` |

Uma linha.

