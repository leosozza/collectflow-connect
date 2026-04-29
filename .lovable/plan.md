## Redesign do Ranking — Mais gamificado e denso

Hoje cada operador ocupa uma linha esticada de ponta-a-ponta com fontes pequenas (10–12px) e medalhas minúsculas. Vou transformar em **cards de pódio** mais altos, em **grid de 2 colunas** no desktop, com tipografia destacada e elementos visuais de gamificação.

### Mudanças (`src/components/gamificacao/RankingTab.tsx`)

**Layout**
- Trocar `space-y-3` (lista 1 coluna esticada) por `grid grid-cols-1 md:grid-cols-2 gap-3` — corta o "esticado".
- Card maior: `rounded-2xl border-2 p-5` com hover sutil de scale.

**Hierarquia visual**
- Pontos em **3xl black** (`text-3xl font-black tracking-tight`) à direita — destaque principal.
- Nome em **base bold** (era `text-sm`), valor recebido em `text-sm font-semibold`.
- Avatar `w-14 h-14` com ring (era `w-9 h-9`).
- Medalhas top-3 em `text-5xl` com drop-shadow (eram emoji pequeno).
- Posição #4+ em círculo cinza com `#N` em `font-black`.

**Gamificação**
- Pódio top-3 com **gradiente temático** por posição:
  - 1º: âmbar/dourado + glow shadow
  - 2º: prata
  - 3º: bronze/laranja
- Número da posição **gigante semitransparente** (7xl, opacity 6%) no fundo do card como marca d'água.
- Badges com emoji: 🎯 taxa, 💰 pagos, ⚠️ quebras — fonte `text-xs` (era 10px).
- Selo "VOCÊ" colorido em vez do `(você)` discreto.
- Barra de progresso `h-2.5` (era `h-1.5`) com `%` numérico em cima.

**Tokens semânticos preservados**: `primary`, `foreground`, `muted-foreground`, `card`, `border`, `destructive`. Cores podium usam tints amber/slate/orange apenas para diferenciar medalhas.

### Resultado
Cards quadrados em pares, fontes maiores, medalhas grandes, glow no 1º lugar, destaque claro do "você". Não fica mais esticado e o visual fica mais "competição/jogo".
