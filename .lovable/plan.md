
# Refinamento visual: Meta da Equipe + 3 KPIs numéricos

Objetivo: trazer estes 4 elementos para a identidade RIVO CONNECT (laranja `--primary` 30 100% 50% sobre fundo escuro `--secondary` 228 24% 13%, Inter, cantos `rounded-2xl`), elevando a hierarquia visual sem alterar lógica, dados ou layout do dashboard.

## Princípios de design aplicados

1. **Hierarquia clara**: número grande (valor) + label pequeno em caixa-alta com tracking + delta colorido fino. Já é o padrão do `KpisGridCard`, vamos reforçar.
2. **Identidade RIVO**: laranja só onde gera ênfase (Meta = card "herói", ícones de KPI numérico em laranja, bordas/glows sutis). Evitar laranja em todos os 4 — perde força.
3. **Card herói vs cards de apoio**: a Meta vira o card de destaque (gradiente escuro + radial laranja). Os 3 KPIs numéricos seguem o tile minimalista atual, mas com ícone em laranja e número levemente maior.
4. **Consistência tipográfica**: tabular-nums em todos os números, Inter 700/800 para valor, 500 uppercase tracking-wide para label.
5. **Microinterações discretas**: hover eleva sombra, ícone respira em 1.05; nada de animação chamativa.

## Mudanças por card

### 1. `DashboardMetaCard.tsx` (Meta da Equipe) — card herói

```text
┌─────────────────────────────────┐
│ 🏆 META DA EQUIPE        Maio   │  ← header escuro (--secondary), texto branco
├─────────────────────────────────┤
│                                 │
│         ╭──────────╮            │
│        │   68%    │             │  ← radial laranja (--primary) com glow
│        │  R$ 68k  │             │     número branco grande no centro
│         ╰──────────╯            │
│                                 │
│   Meta: R$ 100.000              │  ← chip muted
│   Faltam: R$ 32.000 (12 dias)   │
└─────────────────────────────────┘
```

- Topo do card vira faixa `bg-secondary` (azul-escuro RIVO) com ícone Trophy laranja e título branco — diferencia do resto do dashboard.
- `MetaRadialCard`: track em `border/40`, progresso em `--primary` com `drop-shadow` laranja sutil; valor central em `text-foreground` 800.
- Footer com 2 linhas: "Meta" e "Faltam X em Y dias úteis" (já temos os dados, só formatar).
- Caso `goal === 0`: empty-state ilustrado com ícone laranja translúcido e CTA visual "Definir meta" (sem mudar lógica — só estilo).

### 2/3/4. KPIs `Acionados Hoje`, `Acordos do Dia`, `Acordos do Mês` — em `KpisGridCard.tsx`

Manter o componente `Tile`, ajustar APENAS estes 3 (os 3 monetários ficam como estão):

- **Ícone**: fundo `bg-primary/10`, ícone em `text-primary` (laranja RIVO) — hoje cada um usa cor diferente (azul/verde/azul). Unificar dá identidade.
- **Número**: subir para `text-[38px] lg:text-[42px]` font-extrabold, `text-foreground`, `tabular-nums`, leading-none.
- **Label**: `text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium` (já está próximo).
- **Delta**: manter `formatTrendPct` (verde/vermelho/azul, 2 casas) — só reduzir para `text-[10px]` e adicionar mini-ícone trend de 10px.
- **Borda**: `border-border/50` + acento sutil `before:` linha laranja de 2px no topo-esquerdo (ou ring-1 ring-primary/5 no hover) para amarrar à identidade sem poluir.
- **Hover**: `hover:border-primary/30 hover:shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.15)]`.

```text
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 🟧 ACIONADOS │ │ 🟧 ACORDOS   │ │ 🟧 ACORDOS   │
│      HOJE    │ │     DIA      │ │     MÊS      │
│              │ │              │ │              │
│    248       │ │     12       │ │    187       │
│              │ │              │ │              │
│ ↑ 12,40% ont │ │ ↑ 5,00% ont  │ │ ↓ 3,20% mês  │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Arquivos a tocar

- `src/components/dashboard/DashboardMetaCard.tsx` — header escuro + footer informativo.
- `src/components/dashboard/MetaRadialCard.tsx` — paleta para `--primary` + glow.
- `src/components/dashboard/KpisGridCard.tsx` — props/visual dos 3 tiles superiores (sem mexer nos 3 monetários, sem mexer em lógica/props).

Nada fora desses 3 arquivos. Sem migrações, sem mudanças de RPC, sem mudanças de layout no `DashboardPage.tsx`.

## O que NÃO muda

- Cálculos, queries, RLS, tenant_id, props.
- Posição/tamanho dos cards no grid.
- Os outros 3 KPIs monetários (Quebra, Pendentes, Colchão).
- Cores semânticas dos deltas (verde/vermelho/azul — já é regra do sistema).

Resultado: dashboard com um card herói claro (Meta) e três KPIs numéricos coesos na cor da marca, sem ruído visual nos demais blocos.
