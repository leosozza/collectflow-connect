## Objetivo

Hoje os 6 KPIs do topo (Acionados Hoje, Acordos do Dia, Acordos do Mês, Total de Quebra, Pendentes, Colchão de Acordos) estão presos em um único bloco `kpisTop` que se move junto. Vamos transformar **cada KPI em um card independente**, arrastável e ocultável individualmente, no mesmo grid dos demais blocos (Metas, Agendamentos, Total Recebido, Parcelas).

---

## Como vai funcionar (visão do usuário)

- Cada um dos 6 KPIs vira um card próprio, com seu próprio handle de arrastar (ícone grip no hover).
- Podem ser arrastados para qualquer posição da grade, inclusive entre/ao lado de Metas, Total Recebido, Parcelas etc.
- No diálogo **Personalizar**, em vez de um único switch "KPIs superiores", aparecem **6 switches individuais** (um por KPI) + os 4 já existentes (Metas, Agendamentos, Total Recebido, Parcelas) = 10 toggles.
- Botão **Restaurar padrão** volta tudo ao layout inicial: os 6 KPIs nas primeiras posições (largura compacta), seguidos pelos demais cards.

---

## Mudanças técnicas

### 1. Novo conjunto de IDs em `useDashboardLayout.ts`

Substituir o id agregado `kpisTop` por 6 ids individuais:

```ts
type DashboardBlockId =
  | "kpiAcionadosHoje"
  | "kpiAcordosDia"
  | "kpiAcordosMes"
  | "kpiQuebra"
  | "kpiPendentes"
  | "kpiColchao"
  | "metas"
  | "agendamentos"
  | "totalRecebido"
  | "parcelas";
```

- `DEFAULT_DASHBOARD_LAYOUT.order`: 6 KPIs primeiro, depois `metas`, `agendamentos`, `totalRecebido`, `parcelas`.
- `visible`: todos `true` por padrão.
- Bumpar storage key para `rivo:dashboard-layout:v3` (evita layouts antigos com `kpisTop` quebrarem).
- `sanitize` aceita os 10 ids; descarta `kpisTop` se vier do v2.

### 2. `DashboardPage.tsx`

- Remover o case `kpisTop` do `renderBlock`. Em vez disso, cada KPI vira seu próprio case, renderizando **um único card** (extrair o JSX atual do loop `kpis.map(...)` para uma função `renderKpiCard(kpi)`).
- Manter o array `kpis` calculado, mas indexá-lo por id (objeto/`Map`) para que cada case `kpiAcionadosHoje` etc. pegue o KPI correspondente.
- Atualizar `SPAN_CLASS`:
  - KPIs individuais: `col-span-1 lg:col-span-2` (cabem 6 em uma linha de 12 colunas, replicando o visual atual).
  - `metas` / `agendamentos`: `lg:col-span-3`.
  - `totalRecebido` / `parcelas`: `lg:col-span-6`.
- O `gridAutoFlow: dense` continua acomodando livremente.

### 3. `CustomizeDashboardDialog.tsx`

- Atualizar a lista de toggles para 10 itens, com labels amigáveis:
  - Acionados Hoje, Acordos do Dia, Acordos do Mês, Total de Quebra, Pendentes, Colchão de Acordos
  - Metas, Agendamentos para Hoje, Total Recebido, Parcelas Programadas
- Agrupar visualmente com um subtítulo "KPIs" acima dos 6 primeiros e "Cards" acima dos 4 últimos para não virar uma lista corrida.

### 4. `SortableCard.tsx`

Sem mudança estrutural. O handle de arrastar continua igual; só passa a aparecer também nos cards de KPI.

---

## Arquivos afetados

- `src/hooks/useDashboardLayout.ts` — novos ids, novo default, bump para `v3`, `sanitize` atualizado.
- `src/pages/DashboardPage.tsx` — `renderBlock` com cases individuais por KPI, novo `SPAN_CLASS`.
- `src/components/dashboard/CustomizeDashboardDialog.tsx` — 10 switches agrupados em "KPIs" e "Cards".

Sem mudanças em banco, RPC, regras de negócio ou cálculo dos KPIs — apenas reestruturação de layout/persistência.

---

Posso prosseguir?
