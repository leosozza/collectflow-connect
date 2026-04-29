## Objetivo

Agrupar os 3 KPIs (Acionados Hoje, Acordos do Dia, Acordos do Mês) em **um único card maior** que ocupa **uma posição no grid**, contendo internamente **3 tiles lado a lado** (horizontal):

- **Acionados Hoje** — tile inteiro **azul**
- **Acordos do Dia** — tile inteiro **verde**
- **Acordos do Mês** — tile inteiro **laranja**

Os números nunca podem ser cortados — fontes responsivas e `min-w-0` + `truncate` controlado para garantir enquadramento.

## Mudanças

### 1. `src/hooks/useDashboardLayout.ts`
- Substituir os 3 IDs (`acionadosHoje`, `acordosDia`, `acordosMes`) por um único ID novo: **`kpisOperacionais`**.
- Atualizar `ALL_DASHBOARD_BLOCKS`, `DEFAULT_DASHBOARD_LAYOUT.visible` e `DEFAULT_DASHBOARD_LAYOUT.order` (entra na primeira linha onde estavam os KPIs).
- Bump da versão de storage: `v3` → `v4` para invalidar layouts antigos no localStorage.

### 2. Novo componente `src/components/dashboard/KpisOperacionaisCard.tsx`
Card único com 3 tiles **lado a lado** preenchendo toda a largura e altura do slot:

```text
┌────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│ │ AZUL     │ │ VERDE    │ │ LARANJA  │                 │
│ │ Acionad. │ │ Acordos  │ │ Acordos  │                 │
│ │ Hoje     │ │ do Dia   │ │ do Mês   │                 │
│ │ 142      │ │ 8        │ │ 87       │                 │
│ │ +12% ↑   │ │ +5% ↑    │ │ -3% ↓    │                 │
│ └──────────┘ └──────────┘ └──────────┘                 │
└────────────────────────────────────────────────────────┘
```

**Layout interno:**
- Container: `grid grid-cols-3 gap-2 h-full p-2` (3 tiles uniformes lado a lado).
- Cada tile: `rounded-lg p-3 flex flex-col justify-between min-w-0 overflow-hidden`.

**Cores sólidas (gradiente sutil para manter identidade visual):**
- Azul: `bg-gradient-to-br from-blue-500 to-blue-600 text-white`
- Verde: `bg-gradient-to-br from-green-500 to-green-600 text-white`
- Laranja: `bg-gradient-to-br from-orange-500 to-orange-600 text-white`

**Anti-corte de números:**
- Valor principal: `text-xl md:text-2xl font-bold tabular-nums leading-tight tracking-tight break-words`.
- Label menor: `text-[10px] md:text-[11px] font-medium leading-tight opacity-90` (sem truncate — pode quebrar em 2 linhas).
- Ícones em badge `bg-white/20 rounded-md p-1.5` no topo.
- Trends embaixo em texto `text-[10px] opacity-90` com seta colorida em branco/transparência.

### 3. `src/pages/DashboardPage.tsx`
- Remover entradas `acionadosHoje`, `acordosDia`, `acordosMes` do `kpiMap` e do `SPAN_CLASS`.
- Adicionar `kpisOperacionais: "col-span-1 md:col-span-2 row-span-1"` ao `SPAN_CLASS` — ocupa **2 colunas** (necessário para acomodar 3 tiles horizontais sem cortar números). No mobile vira 1 coluna empilhando internamente em scroll horizontal ou grid 3 ainda, mas com fonte menor. Ajuste fino: usar `col-span-1 md:col-span-2 lg:col-span-2 row-span-1`.
- No `renderBlock`, adicionar case `kpisOperacionais` que renderiza `<KpisOperacionaisCard />` recebendo: `acionadosHoje`, `acordosDia` (`stats?.acordos_dia`), `acordosMes` (`stats?.acordos_mes`) e os 3 trends já calculados (`trendAcionados`, `trendAcordosDia`, `trendAcordosMes`).
- Manter cálculos de trends e queries inalterados.

### 4. `src/components/dashboard/CustomizeDashboardDialog.tsx`
- Remover `acionadosHoje`, `acordosDia`, `acordosMes` dos mapas `LABELS` e `DESCRIPTIONS`.
- Adicionar:
  - `kpisOperacionais: "KPIs Operacionais"`
  - descrição: `"Acionados hoje, acordos do dia e do mês"`

## Resultado esperado

- Grid passa de 10 para 8 blocos.
- Novo bloco agrupado é arrastável como uma única peça e ocupa 2 slots horizontais (1 no mobile).
- Os 3 tiles internos são vibrantes (azul/verde/laranja), exibidos lado a lado, com números totalmente visíveis.
- Nenhuma alteração em lógica de dados, RPCs ou trends — apenas reorganização visual.
