

## Adicionar card de Metas no Dashboard

Reutilizar o gauge visual já existente em `GoalsTab` e exibi-lo no `DashboardPage` com comportamento adaptado por papel.

### Comportamento

**Operador (não-admin):**
- Mostra o gauge da própria meta do mês (igual hoje em Gamificação → Metas).
- Usa `fetchMyGoal()` + `operator_points.total_received` do mês corrente.

**Admin:**
- Card com seletor (dropdown) no topo do gauge:
  - **Total da Empresa** (default) → soma de `target_amount` de todas as metas do mês + soma de `total_received` de `operator_points` do mês.
  - **Por operador** → lista cada operador que tem meta definida; ao escolher, mostra o gauge daquele operador (meta vs recebido).
- O seletor respeita o filtro de Mês/Ano já presente no header do dashboard (se um único mês/ano estiver selecionado, usa esse; senão usa mês corrente).

### Arquivos

**1. Novo componente: `src/components/dashboard/MetaGaugeCard.tsx`**
- Extrai o `GaugeChart` SVG de `GoalsTab.tsx` para um componente reutilizável (mesmo visual: vermelho/amarelo/verde, ponteiro animado, dois cards "Meta Recebimento" / "Realizado" abaixo, período).
- Props: `percent`, `received`, `goal`, `monthLabel`, `title` opcional.
- (Refatorar `GoalsTab.tsx` para importar deste novo arquivo, evitando duplicação.)

**2. Novo componente: `src/components/dashboard/DashboardMetaCard.tsx`**
- Encapsula a lógica de busca:
  - Se operador: `fetchMyGoal(year, month)` + `operator_points` do próprio profile.
  - Se admin: `fetchGoals(year, month, null)` + `operator_points` agregado; estado local `selectedOperatorId | "total"`.
- Renderiza `<Select>` (shadcn) acima do `<MetaGaugeCard>` quando admin.
- Props: `year`, `month`, `monthLabel`.

**3. Editar: `src/pages/DashboardPage.tsx`**
- Importar e renderizar `<DashboardMetaCard>` logo abaixo da grade de StatCards (linha ~239), em uma coluna `md:w-1/2` ao lado (ou acima) do card "Parcelas Programadas".
- Layout proposto:

```text
┌─ StatCards (5 cards) ───────────────────────────┐
├─ Metas (gauge) ─────┬─ Parcelas Programadas ───┤
│ [admin: seletor]    │ (card existente)         │
│  gauge SVG          │                          │
└─────────────────────┴──────────────────────────┘
```
Ambos `md:w-1/2` lado a lado em `flex gap-4`.

- Passa `year`/`month` derivados de `filterYear`/`filterMonth` (ou mês corrente como fallback).

### Detalhes técnicos

- "Total da Empresa" (admin):
  - `goal = sum(target_amount)` de `operator_goals` do mês.
  - `received = sum(total_received)` de `operator_points` do mês.
- Reutiliza `formatCurrency` e tokens (`primary`, `success`, `muted`) já existentes — sem cores hardcoded fora do gauge (que mantém vermelho/amarelo/verde semânticos).
- Sem mudanças no schema/RLS — todas as queries já existem (`operator_goals`, `operator_points`).
- Sem migrações de banco.

### Não incluído
- Edição/criação de metas continua exclusivamente no módulo Gamificação (admin já tem ferramenta lá).

