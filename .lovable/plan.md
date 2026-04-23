

## Corrigir Card de Metas no Dashboard

### Problemas
1. O card de Metas tem um seletor de operador redundante — o dashboard já filtra por operador no header global.
2. O "Realizado" usa `operator_points.total_received`, que só é atualizado quando o operador dispara o fluxo de gamificação — fica defasado.

### Solução

**Fonte única de verdade:** usar o mesmo `total_recebido` que já alimenta o StatCard "Total Recebido" do dashboard (vem do RPC `get_dashboard_stats`, filtrado por operador + ano + mês em tempo real). Assim o número do gauge sempre bate com o card "Total Recebido" exibido logo acima.

### Mudanças

**1. `src/components/dashboard/DashboardMetaCard.tsx` — refatorar:**
- Remover por completo o `<Select>` interno e o estado `selectedOperatorId`.
- Remover queries de `operator_points` e da lista de operadores.
- Novas props:
  - `year: number`
  - `month: number`
  - `monthLabel: string`
  - `selectedOperatorUserId: string | null` — o `user_id` selecionado no filtro global (ou `null` para "todos").
  - `received: number` — valor já calculado pelo dashboard (`stats.total_recebido`).
- Lógica de meta:
  - **Operador (não-admin)**: `fetchMyGoal(year, month)` → `goal = target_amount`.
  - **Admin com 1 operador selecionado**: traduzir `user_id → profile.id` (consultar `profiles` pelo `user_id`) e buscar a meta daquele operador via `fetchGoals(year, month, null)` filtrando por `operator_id`.
  - **Admin sem operador (Total da Empresa)**: `fetchGoals(year, month, null)` → `goal = soma de target_amount`.
- Título dinâmico: "Minha Meta do Mês" (operador) / "Meta — Total da Empresa" (admin sem filtro) / "Meta — {nome do operador}" (admin com 1 selecionado).
- O gauge continua usando `<MetaGaugeCard>` sem mudanças visuais.

**2. `src/pages/DashboardPage.tsx`:**
- Passar para o `<DashboardMetaCard>`:
  - `selectedOperatorUserId={selectedOperators.length === 1 ? selectedOperators[0] : null}`
  - `received={stats?.total_recebido ?? 0}`
- Como `stats` já é filtrado por `rpcUserId` + `filterYear` + `filterMonth`, o "Realizado" do gauge passa a refletir o mesmo número (e mesmo período) do StatCard "Total Recebido", em tempo real, sem depender da tabela `operator_points`.

### Comportamento resultante

| Filtro global | Meta exibida | Realizado |
|---|---|---|
| Operador logado (sem filtro) | Sua meta do mês | `total_recebido` próprio (RPC) |
| Admin, sem operador | Soma das metas do mês | `total_recebido` da empresa (RPC) |
| Admin, 1 operador | Meta daquele operador | `total_recebido` daquele operador (RPC) |
| Admin, vários operadores | Soma das metas (todos do mês) | `total_recebido` agregado (RPC) — *limitação atual do RPC, que não filtra por múltiplos*; nesse caso mostraremos a soma global como aproximação e exibiremos um aviso "Selecione um único operador para ver a meta individual" |

### Não incluído
- Nenhuma mudança de schema, RPC ou RLS.
- Sem alterações em `GoalsTab` (Gamificação) — continua usando `operator_points` lá, pois é o contexto de gamificação propriamente dito.

