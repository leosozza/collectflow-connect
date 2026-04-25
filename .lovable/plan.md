## Corrigir card "Total Primeira Parcela" e restaurar "Total Negociado no Mês"

### Diagnóstico
O RPC `get_dashboard_stats` retorna **dois campos distintos** que estavam sendo confundidos:

| Campo | O que calcula | Card correto |
|---|---|---|
| `total_negociado` | Soma APENAS da **1ª parcela** (entrada OU primeira) dos acordos criados no mês | **Total Primeira Parcela do Mês** |
| `total_negociado_mes` | Soma de **TODAS as parcelas** dos acordos criados no mês (~R$ 466.274,07) | **Total Negociado no Mês** |

Hoje o card da coluna esquerda foi renomeado para "Total Primeira Parcela do Mês" mas continua usando `total_negociado_mes` — está mostrando o valor errado. E o KPI "Total Negociado no Mês" foi removido da grade da direita.

### Mudanças em `src/pages/DashboardPage.tsx`

**1. Card da coluna esquerda — usar campo correto:**
- Trocar `stats?.total_negociado_mes` por `stats?.total_negociado` no valor.
- Remover o bloco de tendência (`trendNegociadoMes`) — esse campo não tem `_anterior` no RPC.
- Adicionar legenda discreta: "Soma da 1ª parcela dos acordos do mês".

**2. Restaurar KPI "Total Negociado no Mês" na grade da direita:**
- Reinserir no array `kpis` (antes de "Total de Quebra"):
  - Label: "Total Negociado no Mês"
  - Valor: `formatCurrency(stats?.total_negociado_mes ?? 0)` → mostra os ~R$ 466k
  - Ícone: `Handshake` roxo
  - Trend: `trendNegociadoMes` ("vs mês anterior")

### Resultado
- **Coluna esquerda (acima de Agendamentos):** "Total Primeira Parcela do Mês" com `total_negociado` (valor distinto, menor).
- **Coluna direita (grade KPIs):** volta a ter "Total Negociado no Mês" com `total_negociado_mes` (R$ 466.274,07).
- Sem duplicidade — cada card mostra um valor diferente vindo do mesmo RPC.

### Fora de escopo
- Nenhuma mudança no RPC, na lógica de cálculo ou em outros cards.
