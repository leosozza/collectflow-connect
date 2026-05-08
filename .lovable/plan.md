## Visão 360 — Card unificado no Dashboard

Criar um novo card **Visão 360** no Dashboard que une 3 indicadores monetários em barras horizontais comparativas (estilo do mockup enviado): título no topo, barras horizontais com cor + valor, legenda compacta no rodapé.

### Indicadores

1. **Provisionado no Mês** (azul/primário) — nova métrica.
2. **Pendentes** (âmbar) — `stats.total_pendente` (já existe).
3. **Quebra** (vermelho) — `stats.total_quebra` (já existe).

### Definição de "Provisionado no Mês" (nova métrica)

Para todos os acordos **criados dentro do mês/ano selecionado** (`agreements.created_at` no período, excluindo `cancelled` e `rejected`, respeitando filtros de operador/tenant):

- Se o acordo tem **entrada (`down_payment` > 0)** → soma a entrada.
- Se **não tem entrada** → soma o valor da **1ª parcela** do acordo.

A data de vencimento da entrada/1ª parcela é irrelevante — o que importa é a data de criação do acordo. Isso difere de `total_projetado` (Colchão), que é baseado em parcelas com vencimento dentro do mês.

### Backend — Migration

Criar/atualizar a RPC `get_dashboard_stats_v2` para retornar um novo campo `total_provisionado_mes` (e `total_provisionado_mes_anterior` para o trend), seguindo o mesmo padrão dos demais campos:

- Filtros: `tenant_id`, opcional `_user_id` / `_user_ids`, `_year`, `_month`.
- Lógica: para cada `agreement` criado no mês selecionado e não cancelado/rejeitado:
  - `provisionado_unit = COALESCE(NULLIF(down_payment, 0), valor_da_primeira_parcela)`
- Soma agregada → `total_provisionado_mes`.
- Replicar para o mês anterior → `total_provisionado_mes_anterior`.

A "1ª parcela" será obtida da tabela de parcelas do acordo (a estrutura exata será confirmada na implementação — provavelmente `agreement_installments` ordenadas por número/data, pegando a primeira não-entrada). Se o backend já tiver função utilitária para isso, reutilizamos.

### Frontend

**Novo componente** `src/components/dashboard/Visao360Card.tsx`
- Props: `provisionado`, `pendentes`, `quebra`, `monthLabel`, opcionalmente `trends`.
- Header: título "Visão 360" + subtítulo com o mês.
- Corpo: 3 barras horizontais (`div` com `width %` proporcional ao maior valor entre os três), com label à esquerda e `formatCurrency` à direita; cores via tokens semânticos (primary, amber-500, red-500 já no design system).
- Rodapé: legenda compacta com bolinha colorida + nome + valor.

**`KpisGridCard.tsx`** — remover os tiles "Total de Quebra" e "Pendentes" e suas props/trends. Restam só os 3 KPIs numéricos (Acionados Hoje, Acordos Dia, Acordos Mês) em `grid-cols-3` numa única linha.

**`DashboardPage.tsx`**
- Adicionar `total_provisionado_mes` e `total_provisionado_mes_anterior` na interface `DashboardStats`.
- Renderizar `<Visao360Card />` no grid (linha 2, col 10–12 — slot que vai liberar com a remoção dos KPIs monetários do KpisGrid).
- Passar o novo `provisionado={stats.total_provisionado_mes}` etc.

**`useDashboardLayout.ts`** — adicionar `"visao360"` em `DashboardBlockId` com default `visible: true`.

**`CustomizeDashboardDialog.tsx`** — adicionar o label "Visão 360" no dialog de customização.

### Layout final do Dashboard

```
Linha 1: [Meta 3col]          [TotalRecebido 6col]  [KpisGrid 3col]
Linha 2: [Agendamentos 3col]  [Parcelas 6col]       [Visão 360 3col]
```

### Arquivos afetados

- Migration SQL: atualizar `get_dashboard_stats_v2` para retornar `total_provisionado_mes` + comparativo.
- `src/components/dashboard/Visao360Card.tsx` (novo).
- `src/components/dashboard/KpisGridCard.tsx` (remove 2 tiles).
- `src/pages/DashboardPage.tsx` (interface + render + props).
- `src/hooks/useDashboardLayout.ts` (novo bloco).
- `src/components/dashboard/CustomizeDashboardDialog.tsx` (label).
