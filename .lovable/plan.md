# Refatoração do Grid do Dashboard

## Contexto atual

Hoje o Dashboard tem **5 blocos arrastáveis** (`useDashboardLayout`):
- `kpisTop` — bloco único agrupando 6 mini-KPIs (Acionados Hoje, Acordos do Dia, Acordos do Mês, Total de Quebra, Pendentes, Colchão de Acordos)
- `metas`, `agendamentos`, `totalRecebido`, `parcelas`

O grid usa `grid-cols-12` com `SortableContext` + `rectSortingStrategy` (dnd-kit) e `gridAutoFlow: "dense"`.

A nova especificação trata cada KPI como **card independente**, totalizando **10 cards** com spans próprios.

## Nova lista de blocos (10)

| ID                  | Título               | col-span | row-span |
|---------------------|----------------------|----------|----------|
| `metas`             | Meta do Mês          | 1        | 1        |
| `totalRecebido`     | Total Recebido       | 1        | 2        |
| `acionadosHoje`     | Acionados Hoje       | 1        | 1        |
| `agendamentos`      | Agendamentos Hoje    | 1        | 1        |
| `acordosDia`        | Acordos do Dia       | 1        | 1        |
| `parcelas`          | Parcelas Programadas | 2        | 1        |
| `acordosMes`        | Acordos do Mês       | 1        | 1        |
| `totalQuebra`       | Total de Quebra      | 1        | 1        |
| `pendentes`         | Pendentes            | 1        | 1        |
| `colchaoAcordos`    | Colchão de Acordos   | 1        | 1        |

Ordem inicial (linear, com `gridAutoFlow: dense` posicionando conforme spans):

```
[Meta]            [TotalRecebido▼]   [AcionadosHoje]
[AgendHoje]       [TotalRecebido ]   [AcordosDia]
[Parcelas    ━━]                     [AcordosMes]
[— livre ━━━━━]                      [TotalQuebra]
                                     [Pendentes]
                                     [Colchão]
```

A linearização para o array `order` será:
`["metas", "totalRecebido", "acionadosHoje", "agendamentos", "acordosDia", "parcelas", "acordosMes", "totalQuebra", "pendentes", "colchaoAcordos"]`

## Alterações

### 1. `src/hooks/useDashboardLayout.ts`
- Atualizar `DashboardBlockId` para os 10 IDs novos.
- Atualizar `ALL_DASHBOARD_BLOCKS`, `DEFAULT_DASHBOARD_LAYOUT.visible` e `.order`.
- Bumpar `STORAGE_PREFIX` para `v3` (invalida layout salvo, evita IDs órfãos).
- `sanitize()` permanece igual (já filtra IDs desconhecidos e adiciona faltantes).

### 2. `src/pages/DashboardPage.tsx`
- Substituir o grid `lg:grid-cols-12` por `lg:grid-cols-3` mantendo `grid-auto-rows: minmax(...)` para altura base consistente e `gridAutoFlow: "dense"`.
- Substituir `SPAN_CLASS` por mapa que define **col-span e row-span** Tailwind por id:
  - `parcelas`: `lg:col-span-2`
  - `totalRecebido`: `lg:row-span-2`
  - demais: `col-span-1 row-span-1`
- Responsivo:
  - Mobile (`grid-cols-1`): forçar `row-span-1` em todos (`max-lg:row-span-1 max-lg:col-span-1`).
  - Tablet (`md:grid-cols-2`): `parcelas` ocupa `md:col-span-2`; resto col-span-1; row-span-2 mantido só em `lg`.
- Refatorar `renderBlock(id)` para retornar **um card por KPI individual** reutilizando o mesmo visual do mini-KPI atual (componente local `KpiTile` com label, valor, ícone, trend).
- Remover o sub-grid `kpisTop` interno; cada KPI vira `<SortableCard>` próprio.
- `TotalRecebidoCard` precisa ocupar 100% da altura (row-span-2) — adicionar `h-full` no wrapper interno; verificar se o gráfico se adapta (já é responsivo via container).

### 3. `src/components/dashboard/SortableCard.tsx`
- Atualizar default `spanClassName` e garantir `h-full` no wrapper para que cards com `row-span-2` se estiquem.
- Sem mudança de lógica de drag.

### 4. `src/components/dashboard/CustomizeDashboardDialog.tsx`
- Atualizar `LABELS` e `DESCRIPTIONS` para os 10 novos IDs.

## Drag & Drop
- Mantido 100%: `DndContext` + `SortableContext` com `rectSortingStrategy` já suporta grids com spans variados e `gridAutoFlow: dense` rearranja sem sobreposição.
- `arrayMove` continua válido (reordena array linear; CSS grid recoloca conforme spans).

## Restrições respeitadas
- Nenhuma query, RPC, filtro ou cálculo de KPI é alterado — apenas como são renderizados.
- Identidade visual (bordas, sombras, cores dos ícones) preservada reutilizando classes existentes.

## Arquivos a editar
- `src/hooks/useDashboardLayout.ts`
- `src/pages/DashboardPage.tsx`
- `src/components/dashboard/SortableCard.tsx`
- `src/components/dashboard/CustomizeDashboardDialog.tsx`
