

# Dashboard: 3 Cards + Correção Parcelas

## 1. Novo layout dos cards principais (3 colunas)

| Card | Nome | Lógica |
|------|------|--------|
| 1 | **Colchão de Acordos** | Parcelas (entrada + mensalidades) com vencimento no mês, de acordos criados **antes** do mês selecionado e não cancelados |
| 2 | **Total de Primeira Parcela no Mês** | Primeira parcela dos acordos criados **no** mês selecionado |
| 3 | **Total Negociado no Mês** | Todas as parcelas (entrada + mensalidades) dos acordos criados **no** mês selecionado |

Grid muda de `grid-cols-2` para `grid-cols-3`, com padding/tamanho de fonte ligeiramente reduzidos para caber.

## 2. Migration SQL — `get_dashboard_stats`

- Adicionar coluna de retorno `total_negociado_mes numeric`
- **Colchão (projetado)**: mesma lógica de parcelas virtuais no mês, mas filtrando `created_at < _month_start`
- **Primeira Parcela (negociado)**: mantém como está (soma primeira parcela de acordos criados no mês)
- **Total Negociado Mês**: soma todas as parcelas virtuais com vencimento no mês de acordos criados no mês

## 3. Correção da numeração de parcelas — `get_dashboard_vencimentos`

Problema: entrada aparece como parcela 0 e regulares como 1,2,3... sem considerar se há entrada.

Correção:
- Entrada → parcela **1**
- Parcelas regulares → se tem entrada: `i + 2`, senão: `i + 1`

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/DashboardPage.tsx` | 3 cards, novo campo `total_negociado_mes`, grid 3 colunas |
| Nova migration SQL | Atualizar `get_dashboard_stats` (novo campo + lógica colchão) e `get_dashboard_vencimentos` (numeração) |

## Detalhes técnicos

```text
┌──────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ Colchão de       │ │ Total de Primeira    │ │ Total Negociado      │
│ Acordos          │ │ Parcela no Mês       │ │ no Mês               │
│                  │ │                      │ │                      │
│ created_at <     │ │ created_at IN month  │ │ created_at IN month  │
│ month_start      │ │ SUM(1st payment)     │ │ SUM(all installments)│
│ SUM(due in month)│ │                      │ │                      │
└──────────────────┘ └──────────────────────┘ └──────────────────────┘
```

