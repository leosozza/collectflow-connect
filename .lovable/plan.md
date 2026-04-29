## Objetivo

Reorganizar o Dashboard num grid **6 colunas × 2 linhas**:

- **Linha 1 (topo)**: KPIs operacionais (4 tiles coloridos) + card consolidado Quebra/Pendentes/Colchão.
- **Linha 2 (base)**: Agendamentos (esq) | Parcelas Programadas (centro) | Meta (dir) — cada um ocupando 2 colunas.

Criar novo KPI **Ticket Médio dos Acordos do Dia** e consolidar Quebra+Pendentes+Colchão num card único de 3 tiles internos.

## Layout do grid

```text
Linha 1 (topo):
┌──────────────────────────┬──────────────────────────┐
│ KPIs Operacionais        │ Quebra | Pend. | Colchão │
│ 4 tiles coloridos        │ 3 tiles num card         │
│ (Acionados | Ac.Dia |    │                          │
│  Ac.Mês | Ticket Médio)  │                          │
│ 3 cols × 1 row           │ 3 cols × 1 row           │
├──────────────┬───────────┴────────┬─────────────────┤
│ Agendamentos │ Parcelas           │ Meta (gauge)    │
│ Hoje         │ Programadas        │ altura fixa     │
│ 2 cols × 1   │ 2 cols × 1         │ 2 cols × 1      │
└──────────────┴────────────────────┴─────────────────┘
Linha 2 (base)
```

Tailwind: `grid-cols-1 md:grid-cols-2 lg:grid-cols-6` com `auto-rows-[minmax(220px,auto)]`.

Spans (desktop `lg`):
- `kpisOperacionais`: `lg:col-span-3 lg:row-span-1`
- `kpisFinanceiros`: `lg:col-span-3 lg:row-span-1`
- `agendamentos`: `lg:col-span-2 lg:row-span-1`
- `parcelas`: `lg:col-span-2 lg:row-span-1`
- `metas`: `lg:col-span-2 lg:row-span-1`
- `totalRecebido` (gráfico): `lg:col-span-6 lg:row-span-2` (linha extra abaixo, opcional — mantém visível mas não obrigatório no topo).

Comportamento de altura:
- **Meta**: `max-h-[220px]` no card raiz. Não cresce mesmo se reposicionado.
- **Agendamentos**: cresce até a altura da linha (mesma do Parcelas), com `overflow-auto` interno na lista quando excede.
- **Parcelas**: mantém altura referência atual.
- **KPIs Operacionais (4 tiles) e KPIs Financeiros (3 tiles)**: altura compacta da linha 1 (~220px), tiles preenchem `h-full`.

## Mudanças por arquivo

### 1. `src/hooks/useDashboardLayout.ts`
- Substituir IDs `totalQuebra`, `pendentes`, `colchaoAcordos` por **um único** `kpisFinanceiros`.
- Nova ordem padrão (topo → base):
  ```
  ["kpisOperacionais", "kpisFinanceiros", "agendamentos", "parcelas", "metas", "totalRecebido"]
  ```
- Atualizar `ALL_DASHBOARD_BLOCKS` e `visible` defaults.
- Bump versão storage: `v5` → `v6` para invalidar layouts antigos.

### 2. `src/pages/DashboardPage.tsx`
- Mudar grid para `grid-cols-1 md:grid-cols-2 lg:grid-cols-6` com `auto-rows-[minmax(220px,auto)]`.
- Atualizar `SPAN_CLASS` conforme tabela acima.
- Adicionar query nova para ticket médio do dia (ver snippet abaixo).
- Remover entradas antigas `totalQuebra`/`pendentes`/`colchaoAcordos` do `kpiMap` e do `renderBlock`.
- Adicionar caso `kpisFinanceiros` no `renderBlock` retornando `<KpisFinanceirosCard ... />`.
- Passar `ticketMedioDia` para `<KpisOperacionaisCard />`.

### 3. `src/components/dashboard/KpisOperacionaisCard.tsx`
- Mudar de `grid-cols-3` para `grid-cols-4`.
- Adicionar 4º tile: **Ticket Médio Dia** (gradient teal/cyan: `from-teal-500 to-cyan-600`, ícone `Receipt`).
- Aceitar nova prop `ticketMedioDia: number` e formatar com `formatCurrency`.

### 4. `src/components/dashboard/KpisFinanceirosCard.tsx` (NOVO)
- Card único `bg-card rounded-xl border border-border shadow-sm h-full p-1.5`.
- `grid-cols-3 gap-1.5 h-full` contendo 3 tiles internos no mesmo padrão visual atual:
  - **Total de Quebra** (vermelho) — ícone `TrendingDown`
  - **Pendentes** (âmbar) — ícone `Hourglass`
  - **Colchão de Acordos** (índigo) — ícone `Wallet`
- Usar mesmo estilo de tile usado em `renderKpiTile` atual (label, valor, trend opcional).
- Props: `quebra`, `pendentes`, `colchao`, `trendQuebra`, `trendPendentes`.

### 5. `src/components/dashboard/MetaGaugeCard.tsx` + `DashboardMetaCard.tsx`
- Reduzir `size` default do gauge para `150`.
- Adicionar `max-h-[220px] overflow-hidden` no card raiz do `DashboardMetaCard`.
- Layout interno mantido (esquerda: Meta/Realizado/período; direita: gauge).

### 6. `src/components/dashboard/AgendamentosHojeCard.tsx`
- Container raiz: `flex flex-col h-full max-h-full`.
- Substituir `max-h-[200px]` da lista por `flex-1 overflow-auto min-h-0` (scroll quando exceder altura disponível, cresce até o limite da linha).

### 7. `src/components/dashboard/CustomizeDashboardDialog.tsx`
- Atualizar lista de blocos: remover `totalQuebra/pendentes/colchaoAcordos`, adicionar `kpisFinanceiros` e `kpisOperacionais` (se ainda não estiver).

## Novo KPI: Ticket Médio dos Acordos do Dia

Calculado client-side (sem migration) em `DashboardPage.tsx`:

```typescript
const { data: ticketMedioDia = 0 } = useQuery({
  queryKey: ["dashboard-ticket-medio-dia", rpcUserId, rpcUserIdsKey, profile?.tenant_id],
  queryFn: async () => {
    const today = new Date().toISOString().slice(0, 10);
    let q = supabase
      .from("agreements")
      .select("entrada_value, new_installment_value, custom_installment_values, created_by")
      .eq("tenant_id", profile!.tenant_id!)
      .gte("created_at", `${today}T00:00:00Z`)
      .lte("created_at", `${today}T23:59:59Z`)
      .not("status", "in", "(cancelled,rejected)");
    if (rpcUserIds) q = q.in("created_by", rpcUserIds);
    else if (rpcUserId) q = q.eq("created_by", rpcUserId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) return 0;
    const total = data.reduce((acc, a: any) => {
      const civ = a.custom_installment_values || {};
      const v = a.entrada_value > 0
        ? Number(civ.entrada ?? a.entrada_value)
        : Number(civ["1"] ?? a.new_installment_value ?? 0);
      return acc + v;
    }, 0);
    return total / data.length;
  },
  enabled: !!profile?.tenant_id,
  refetchInterval: 60_000,
});
```

(Mesma lógica do RPC `get_dashboard_stats` para `_negociado`, restrita a hoje.)

## Resultado esperado

- Grid 6×2 fixo: linha de cima com KPIs Operacionais (4 tiles) + KPIs Financeiros (Quebra/Pendentes/Colchão num card só); linha de baixo com Agendamentos | Parcelas | Meta, cada um 2 colunas.
- 4 KPIs operacionais com mesmo padrão de cards coloridos com gradiente, incluindo o novo **Ticket Médio Dia**.
- Card Meta nunca cresce além de 220px de altura.
- Agendamentos cresce até a altura da linha de baixo, com scroll interno quando excede.
- Drag-and-drop continua funcional; bump `v5 → v6` invalida layouts antigos.

## Restrições

- **Sem migration** de banco — Ticket Médio do Dia calculado via query client-side adicional.
- Lógica de meta, RPCs e demais cálculos **inalterados**.
- Visual interno dos cards Agendamentos, Parcelas e Meta permanece como já implementado, apenas ajustes de altura/largura.
