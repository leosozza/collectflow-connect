
# Destacar o Colchão dentro do card "Meta da Equipe"

Hoje o Colchão está em `text-xs` cinza, no canto superior esquerdo, quase invisível sobre o fundo branco. Vamos transformar em um **chip/pílula** com cor de marca, mantendo a posição (canto sup. esq.) mas com peso visual real.

## Layout proposto

```text
┌─────────────────────────────┐
│ 🏆 META DA EQUIPE      Maio │ ← header escuro
├─────────────────────────────┤
│ ┌────────────────┐          │
│ │ 💼 COLCHÃO     │          │ ← chip laranja sutil
│ │ R$ 32.450      │          │   com borda + bg primary/8
│ └────────────────┘          │
│                             │
│        ╭────────╮           │
│       │   68%   │           │
│        ╰────────╯           │
│                             │
│      META RECEBIMENTO       │
│      R$ 100.000             │
│      01/05 à 31/05          │
├─────────────────────────────┤
│ Recebido        Faltam      │
│ R$ 68k          R$ 32k      │
└─────────────────────────────┘
```

## Mudanças visuais (`DashboardMetaCard.tsx`)

Transformar o bloco do Colchão em um **chip destacado**:

- **Container**: `bg-primary/8` + `border border-primary/25` + `rounded-lg` + `px-2.5 py-1.5`
- **Linha 1 — Label**: ícone `Wallet` 12px em `text-primary` (laranja cheio, sem opacidade) + texto `COLCHÃO` em `text-[10px] font-semibold uppercase tracking-[0.08em] text-primary`
- **Linha 2 — Valor**: `text-sm font-bold text-foreground tabular-nums` (vs `text-xs` atual)
- **Posição**: mantém `absolute top-2 left-3`, mas agora vira chip compacto, fica destacado em vez de "flutuando solto"

Resultado: Colchão fica imediatamente legível e amarrado à identidade RIVO (laranja), sem competir com o radial central.

## O que NÃO muda

- Lógica/dados/props.
- Posição (continua canto sup. esq.).
- Radial central + Meta abaixo + footer Recebido/Faltam.
- Qualquer outro card.
