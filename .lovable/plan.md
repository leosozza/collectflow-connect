## Objetivo

1. Fazer o Dashboard caber inteiro na altura visível, sem barra de rolagem geral.
2. Permitir o drag-and-drop reposicionar qualquer card livremente (incluindo "Total Recebido" indo para baixo de "Meta do Mês").
3. Estabilizar o arrasto: enquanto um card é movido, os demais devem ficar parados — apenas o slot de destino realça, sem reembaralhar a grade inteira.

---

## 1. Tela fixa, sem scroll geral

Hoje a grade usa `auto-rows-[minmax(220px,auto)]`, o que deixa as linhas crescerem livremente e força scroll na página.

Mudanças em `src/pages/DashboardPage.tsx`:

- Container externo (`<div className="flex flex-col gap-4 ... h-full min-h-0">`) — manter `h-full` e `overflow-hidden` para travar a tela na altura da viewport.
- Grid: trocar para 2 linhas com altura proporcional fixa, sem crescer:
  - `grid grid-cols-6 gap-3 flex-1 min-h-0`
  - `grid-template-rows: minmax(0,1fr) minmax(0,1fr)` (via `style` ou classe util)
- Cada `SortableCard` recebe `h-full min-h-0 overflow-hidden` para nunca empurrar o layout.
- Cards com listas internas (Agendamentos, Parcelas, Total Recebido) já precisam ter `overflow-auto` no corpo — confirmar/forçar isso para que o conteúdo role internamente em vez de estourar a célula.
- Reduzir `gap` (de 4 para 3) e revisar paddings internos (`p-4` → `p-3` em headers/listas) para garantir folga em telas 1366×768.

Resultado: a tela inteira do Dashboard cabe sem scroll global; somente listas internas rolam.

## 2. Drag-and-drop livre (Total Recebido podendo ir para qualquer posição)

O comportamento atual já reordena via `arrayMove`, mas a presença de `gridAutoFlow: "dense"` faz o navegador "puxar" cards para preencher buracos automaticamente, o que confunde a posição final do drop.

Mudanças:

- `src/pages/DashboardPage.tsx`: remover `style={{ gridAutoFlow: "dense" }}` do grid. A ordem passa a ser estritamente a definida em `layout.order`.
- Manter `rectSortingStrategy` (já em uso) — funciona bem para grids de múltiplos tamanhos.
- Em `useDashboardLayout.ts`: nada muda na estrutura — a ordem linear já é suficiente. Bumpar prefixo de storage para `v7` para limpar layouts antigos com `gridAutoFlow: dense` salvos.

Com isso, ao soltar "Total Recebido" sobre o slot de "Meta do Mês", o array é reordenado e o card ocupa exatamente a posição alvo.

## 3. Arrasto estável (sem reembaralhar tudo durante o drag)

Hoje, com `useSortable` + `rectSortingStrategy`, todos os cards aplicam `transform` em tempo real durante o hover, dando a sensação de que a grade inteira "balança". Para o usuário, isso parece que tudo está se movendo junto.

Mudanças em `src/components/dashboard/SortableCard.tsx`:

- Usar `DragOverlay` do `@dnd-kit/core`: o card arrastado é renderizado num overlay flutuante e os cards originais **não** sofrem `transform` durante o arrasto.
- Adicionar `onDragStart`/`onDragEnd` em `DashboardPage.tsx` controlando `activeId`. Enquanto `activeId` existir, renderizar `<DragOverlay>{renderBlock(activeId)}</DragOverlay>`.
- No `SortableCard`, quando `isDragging === true`, manter apenas um placeholder com `opacity-30` no lugar original (sem aplicar `transform` aos vizinhos).
- Trocar `rectSortingStrategy` por uma estratégia mais "estática": remover `strategy` (default) e mover a reordenação só no `onDragEnd`. Os outros cards permanecem visualmente parados; apenas o slot sob o cursor recebe um realce sutil (`ring-2 ring-primary/40`) via estado `overId`.

Resultado: ao arrastar um card, somente ele se move (no overlay) e o destino fica destacado. Os demais cards ficam imóveis até o drop ser confirmado.

---

## Detalhes técnicos

Arquivos afetados:

- `src/pages/DashboardPage.tsx`
  - Grid: `grid-cols-6` com `grid-template-rows: 1fr 1fr`, `flex-1 min-h-0`, sem `gridAutoFlow: dense`.
  - Adicionar `activeId` state, `onDragStart`, `onDragOver` (para `overId`), `onDragEnd`.
  - Renderizar `<DragOverlay>` com `renderBlock(activeId)` quando ativo.
  - Container raiz: `h-full min-h-0 overflow-hidden`.

- `src/components/dashboard/SortableCard.tsx`
  - Receber prop `isOver` (opcional) para aplicar realce de destino.
  - Quando `isDragging`, ocultar conteúdo e mostrar placeholder; não aplicar `CSS.Transform`.

- `src/hooks/useDashboardLayout.ts`
  - Bumpar `STORAGE_PREFIX` para `rivo:dashboard-layout:v7` (limpa layouts antigos).

- Cards internos com listas (`AgendamentosHojeCard`, `ParcelasProgramadasCard`, `TotalRecebidoCard`)
  - Garantir `flex flex-col h-full min-h-0` no card raiz e `overflow-auto min-h-0` no corpo da lista/gráfico.

Sem mudanças de banco. Sem mudanças em RLS/edge functions.

```text
Layout final (6 col x 2 rows, altura fixa):

+------------------+------------------+------------------+
|  KPIs Operac.    |  KPIs Operac.    |  KPIs Financ.    |   row 1 (1fr)
|  (col-span 3)    |                  |  (col-span 3)    |
+--------+---------+---------+--------+---------+--------+
| Agend. | Agend.  | Parcelas| Parc.  | Meta    | Meta   |   row 2 (1fr)
| (2)    |         | (2)     |        | (2)     |        |
+--------+---------+---------+--------+---------+--------+

Total Recebido entra na grade só quando visível, ocupando 2 cols
e empurrando outro card para fora da view (ou substituindo via drag).
```

Observação sobre "Total Recebido": como agora ele tem `col-span-2` (largura igual a Meta), ele passa a fazer parte da rotação de 6 slots × 2 linhas. Se o usuário deixar todos os 6 cards visíveis (5 atuais + Total Recebido), serão exatamente 6 slots ocupando a tela inteira sem scroll.
