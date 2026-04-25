## Restaurar card "Total Primeira Parcela do Mês"

### Contexto
- O valor "Total Primeira Parcela do Mês" corresponde ao campo `total_negociado_mes` do RPC `get_dashboard_stats` (soma da primeira parcela dos acordos criados no mês).
- Hoje esse valor aparece duplicado:
  1. Como KPI "Total Negociado no Mês" (Handshake roxo) na grade da coluna direita.
  2. Como `TotalAcordosMiniCard` ("Total de Acordos Realizados") na coluna esquerda, com gráfico de barras 30d.
- O usuário quer remover o `TotalAcordosMiniCard` e colocar no lugar dele o card antigo simples de "Total Primeira Parcela do Mês".

### Mudanças

**1. `src/pages/DashboardPage.tsx`**
- Remover o import de `TotalAcordosMiniCard`.
- Na Coluna 1 (esquerda), substituir `<TotalAcordosMiniCard ... />` por um card compacto inline (mesmo estilo dos KPIs da coluna direita) com:
  - Label: "Total Primeira Parcela do Mês"
  - Ícone: `Handshake` em roxo (`text-purple-500` / `bg-purple-500/10`)
  - Valor: `formatCurrency(stats?.total_negociado_mes ?? 0)`
  - Tendência: `trendNegociadoMes` ("vs mês anterior")
- Como agora esse KPI passa a viver na coluna esquerda como card dedicado, **remover** "Total Negociado no Mês" do array `kpis` da coluna direita para evitar duplicidade. Restam 6 KPIs na grade 2×3 da direita (já era a quantidade prevista no plano original).

**2. `src/components/dashboard/TotalAcordosMiniCard.tsx`**
- Excluir o arquivo (componente deixará de ser usado).

### Layout resultante
```text
COLUNA 1 (esquerda)            COLUNA 2 (centro)        COLUNA 3 (direita)
┌─────────────────────┐        ┌──────────────────┐     ┌───────────┬───────────┐
│ Total Primeira      │        │ Total Recebido   │     │ Acionados │ Acordos D │
│ Parcela do Mês      │        │ (gráfico)        │     ├───────────┼───────────┤
└─────────────────────┘        │                  │     │ Acordos M │ Quebra    │
┌─────────────────────┐        ├──────────────────┤     ├───────────┼───────────┤
│ Agendamentos Hoje   │        │ Parcelas         │     │ Pendentes │ Colchão   │
│                     │        │ Programadas      │     └───────────┴───────────┘
└─────────────────────┘        └──────────────────┘     ┌───────────────────────┐
                                                        │ Metas (gauge)         │
                                                        └───────────────────────┘
```

### Fora de escopo
- Nenhuma mudança em RPCs, lógica de cálculo ou nos demais cards.
- Personalização (`CustomizeDashboardDialog`) e flags de visibilidade permanecem inalteradas.
