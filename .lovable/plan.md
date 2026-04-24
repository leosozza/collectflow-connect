## Reorganização do Dashboard em 3 colunas

Inspirado na imagem de referência (apenas como guia de divisão), o Dashboard será reestruturado em **3 colunas verticais** que se mantêm alinhadas em telas grandes. Cada bloco terá largura previsível para que KPIs e gráficos caibam sem cortes.

### Layout proposto

```text
┌─────────────────────┬──────────────────────────────┬─────────────────────────────┐
│ COLUNA 1 (esquerda) │ COLUNA 2 (centro)            │ COLUNA 3 (direita)          │
│ (3/12)              │ (6/12)                       │ (3/12)                      │
├─────────────────────┼──────────────────────────────┼─────────────────────────────┤
│ Filtro Operador     │ Total Recebido (gráfico área)│ KPIs em grade 2×N           │
│ Total Acordos       │                              │  ┌──────────┬──────────┐    │
│ (mini-card)         │                              │  │Acionados │Processos │    │
│                     │                              │  ├──────────┼──────────┤    │
├─────────────────────┼──────────────────────────────┤  │Acordos   │Pendentes │    │
│ Agendamentos Hoje   │ Parcelas Programadas         │  └──────────┴──────────┘    │
│                     │ (com navegação de data)      ├─────────────────────────────┤
│                     │                              │ Metas (gauge)               │
└─────────────────────┴──────────────────────────────┴─────────────────────────────┘
```

- Em telas `<lg`: tudo vira coluna única (mobile-first).
- Em `lg+`: grid de 12 colunas → 3 / 6 / 3.
- Os KPIs deixam de ocupar uma faixa horizontal de 7 colunas no topo e passam para a coluna direita em **grade 2 colunas × 3-4 linhas**, exatamente como na referência (cards azul, ciano, laranja, verde, etc.).

### Mudanças nos KPIs (sem cortes)

Os 7 KPIs atuais serão reorganizados em **6 cards compactos** (2 colunas) na coluna direita:
1. Acionados Hoje
2. Acordos do Dia
3. Acordos do Mês
4. Total Negociado no Mês
5. Pendentes
6. Colchão de Acordos

(*Total de Quebra* permanece disponível pela personalização, mas não no padrão para evitar overflow visual em coluna estreita.)

Ajustes visuais nos cards para caber sem cortes:
- Padding reduzido (`px-3 py-2.5`)
- Label em `text-[10px]` com `leading-tight`, permitindo quebrar em 2 linhas (sem `truncate`)
- Valor em `text-base` a `text-lg`, `tabular-nums`, com `break-all` apenas quando necessário
- Ícone em chip menor (28×28)
- Tendência (`+12% vs ontem`) em linha única abaixo do valor
- Em valores monetários longos (R$ 1.234.567,89), usar `text-sm` para garantir uma linha

### Colunas detalhadas

**Coluna 1 (esquerda, 3/12):**
- Card "Total de Acordos Realizados" (mini sparkline com `total_recebido` agregado)
- Card "Agendamentos para Hoje" (`AgendamentosHojeCard`)

**Coluna 2 (centro, 6/12):**
- Card "Recebimentos (Últimos 30 dias)" — `TotalRecebidoCard` ampliado para ocupar a coluna inteira
- Card "Parcelas Programadas" — `ParcelasProgramadasCard` com mesma largura

**Coluna 3 (direita, 3/12):**
- Grade `grid-cols-2 gap-3` com os 6 KPIs compactos
- Card "Metas" (`DashboardMetaCard`) abaixo dos KPIs

### Detalhes técnicos

**Arquivo principal:** `src/pages/DashboardPage.tsx`
- Substituir o bloco "KPI cards row (top)" e o `grid-cols-3` atual por um único container `grid grid-cols-1 lg:grid-cols-12 gap-4 items-start`.
- Coluna 1: `lg:col-span-3 flex flex-col gap-3`
- Coluna 2: `lg:col-span-6 flex flex-col gap-3`
- Coluna 3: `lg:col-span-3 flex flex-col gap-3` contendo:
  - `<div className="grid grid-cols-2 gap-3"> ...kpis... </div>`
  - `<DashboardMetaCard ... />`
- Manter `layout.visible.kpisTop` controlando a visibilidade da grade de KPIs (renomeado mentalmente para "KPIs lateral", sem mudar a chave para preservar preferências salvas).
- Manter `layout.visible.parcelas`, `totalRecebido`, `metas`, `agendamentos` controlando seus respectivos cards nas novas posições.

**Novo card "Total de Acordos Realizados" (coluna 1):**
- Componente leve inline ou pequeno arquivo `src/components/dashboard/TotalAcordosMiniCard.tsx`
- Mostra `formatCurrency(stats?.total_negociado ?? 0)` + label "Últimos 30 dias"
- Sparkline opcional reutilizando os pontos já calculados em `TotalRecebidoCard` (extrair série compartilhada para um pequeno hook `useReceivedSeries(days)` em `src/hooks/useReceivedSeries.ts`).
- Caso queira manter escopo mínimo, esse mini-card entra apenas com valor + variação (sem sparkline) numa primeira versão.

**Ajustes em `MetaGaugeCard.tsx`:**
- Reduzir `size` padrão para `170` quando renderizado dentro da coluna estreita (passar `size={170}` no `DashboardMetaCard`).
- Garantir que `formatCurrency` use `text-sm` para evitar overflow em "R$ 150.000,00".

**Ajustes em `TotalRecebidoCard.tsx` e `ParcelasProgramadasCard.tsx`:**
- Apenas garantir `w-full` no container raiz; nenhuma mudança de lógica.

**Responsividade:**
- `<lg` (mobile/tablet): tudo vira `grid-cols-1`, ordem natural (Coluna 1 → Coluna 2 → Coluna 3).
- `lg-xl`: 12 colunas conforme plano.
- `2xl+`: mesmas proporções, com `gap-4`.

### Fora de escopo
- Não serão alterados os RPCs nem os dados retornados.
- A personalização (`CustomizeDashboardDialog`) continua funcionando; os mesmos blocos seguem visíveis/ocultáveis, apenas reposicionados.
- A imagem enviada serve **apenas como referência da divisão em 3 colunas** — cores, tipografia e identidade visual atuais do RIVO CONNECT são mantidas.