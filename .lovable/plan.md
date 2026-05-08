
# Reorganizar card "Meta da Equipe" e remover Colchão do grid de KPIs

## Layout proposto

```text
┌──────────────────────┐
│ 🏆 META DA EQUIPE  M │ ← header escuro RIVO
├──────────────────────┤
│ COLCHÃO              │ ← canto sup. esq. (discreto)
│ R$ 32.450            │
│                      │
│      ╭──────╮        │
│     │  68%  │        │ ← radial laranja (centralizado)
│      ╰──────╯        │
│                      │
│ META RECEBIMENTO     │ ← abaixo do gráfico
│ R$ 100.000           │
│ 01/05 à 31/05        │
├──────────────────────┤
│ Recebido   Faltam    │ ← footer mantém
│ R$ 68k     R$ 32k    │
└──────────────────────┘
```

E o grid de KPIs passa de 6 tiles (3×2) para **5 tiles**, reorganizados como **5×1** ou **3+2** — ver decisão abaixo.

## Mudanças

### 1. `DashboardMetaCard.tsx`
- Nova prop `colchao: number`.
- Bloco discreto **canto superior esquerdo** logo abaixo do header (antes do radial):
  - Label `COLCHÃO` em `text-[9px] uppercase tracking-[0.08em] text-muted-foreground/70`.
  - Valor em `text-xs font-semibold text-foreground tabular-nums`.
  - Tooltip: "Parcelas com vencimento no mês originadas de acordos criados em meses anteriores (entrada + parcelas mensais)."

### 2. `MetaRadialCard.tsx`
- **Remover** o bloco "Meta Recebimento + valor + período" que hoje fica acima do radial.
- **Adicionar abaixo** do radial:
  - `META RECEBIMENTO` em `text-[9px] uppercase tracking-wide text-muted-foreground`.
  - `formatCurrency(goal)` em `text-base font-bold tabular-nums`.
  - Período `01/MM à DD/MM` em `text-[9px] text-muted-foreground/70`.

### 3. `KpisGridCard.tsx`
- **Remover** o tile "Colchão de Acordos" e a prop `colchao`.
- Reorganizar o grid de **3×2 → 3×2 com 5 tiles** (uma célula vazia visualmente fica estranho). Opções:
  - **Opção A (recomendada)**: grid `grid-cols-3 grid-rows-2`, mas o último tile (Pendentes) ocupa `col-span-1` e o anterior (Quebra) também — sobra 1 célula. Para evitar buraco, mudar para **`grid-cols-3 grid-rows-2` com Acordos do Mês ocupando `col-span-1 row-span-1` mas Pendentes e Quebra alinhados na linha de baixo com `col-span-1` cada e a 3ª coluna inferior absorvida — simplesmente fica 3+2** (3 KPIs numéricos em cima, 2 monetários embaixo centralizados).
  - **Opção B**: 5 colunas em uma linha (`grid-cols-5`) — mais horizontal, mas tiles ficariam estreitos.
  - Vou seguir **Opção A**: linha 1 = Acionados/Acordos Dia/Acordos Mês (3 colunas); linha 2 = Quebra/Pendentes (2 colunas centralizadas com `col-start-1 col-span-3` distribuído via flex ou `col-span-3` dividido em 2).
  - Implementação simples: linha 1 `grid-cols-3`, linha 2 `grid-cols-2` (dois containers empilhados via `flex flex-col gap-2` interno).

### 4. `DashboardPage.tsx`
- Passar `colchao={stats?.total_projetado ?? 0}` para `<DashboardMetaCard />`.
- Remover `colchao={...}` da chamada de `<KpisGridCard />`.

## O que NÃO muda
- Lógica, queries, RPCs, cálculos.
- Header escuro, footer "Recebido / Faltam", glow laranja do radial.
- Layout do dashboard (posição/tamanho dos blocos).
- Os outros 5 KPIs.

Resultado: card de Meta ganha contexto estratégico (Colchão) sem poluição, e o grid fica mais limpo com 5 tiles ao invés de 6.
