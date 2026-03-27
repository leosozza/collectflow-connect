

# Plano: Diferenciar "Acordo Vigente" de "Em dia"

## Contexto

Hoje existem dois mapeamentos diferentes para o status `pending`:
- `AgreementsList.tsx` (página /acordos): exibe **"Vigente"**
- `ClientDetailPage.tsx` (perfil do cliente): exibe **"Em dia"**

O pedido é padronizar:
- Clientes **com acordo** e pagamento em dia → **"Acordo Vigente"**
- Clientes **sem acordo** (status geral) → **"Em dia"**

## Análise

O status `pending` na tabela `agreements` sempre se refere a um acordo. Portanto:
- Na `AgreementsList.tsx` e no `ClientDetailPage.tsx` (onde exibe o badge do acordo), o label correto é **"Acordo Vigente"**
- O "Em dia" ficaria reservado para contextos onde se fala do status geral do cliente (sem acordo)

## Mudanças

| Arquivo | Mudança |
|---|---|
| `src/pages/ClientDetailPage.tsx` | Trocar `pending: "Em dia"` para `pending: "Acordo Vigente"` no `statusLabelsMap` |
| `src/components/acordos/AgreementsList.tsx` | Trocar `pending: "Vigente"` para `pending: "Acordo Vigente"` no `statusLabels` |

Apenas 2 linhas alteradas, sem impacto em lógica ou fluxo de boletos.

