# Dashboard responsivo (1366×768 → 1920×1080)

## Diagnóstico

A grade atual do `DashboardPage.tsx` força **toda a tela em uma altura fixa** (`h-full overflow-hidden` + 2 linhas `grid-rows-[minmax(0,1fr)_minmax(0,1.4fr)]`). Em telas como **1600×900** isso causa:

- Linhas da tabela "Parcelas Programadas" cortadas (Roberto sem credor visível).
- Visão 360 com gauge "Projeção" muito grande comprimindo as barras de cima/baixo.
- Cards Meta/Total Recebido com tipografia desproporcional.
- Cards filhos só têm 2 conjuntos de estilos (`base` e `xl:`). Entre **1024–1279 (lg)** e em **1366×768** não há ajuste — usam o tamanho compacto base, mesmo sobrando espaço, ou explodem em telas médias.
- Header com botões/filtros estoura em ≤1366 (quebra para 2 linhas).

## O que vou fazer

### 1. Grid principal (`DashboardPage.tsx`)
- Trocar `h-full overflow-hidden` por **altura mínima + scroll vertical quando necessário** em viewports baixos (`@media (max-height: 900px)` e `< lg`).
- Ajustar as linhas: usar `auto` em telas baixas e `minmax(280px, 1fr) minmax(360px, 1.4fr)` apenas em `2xl+`. Em `lg` (1024–1279) reduzir a 2ª linha.
- Adicionar gap responsivo `gap-2 lg:gap-2.5 xl:gap-3 2xl:gap-4`.

### 2. Header de filtros
- Em `< xl`: reduzir largura dos `MultiSelect` (Ano 80px / Mês 96px / Operador 128px).
- Esconder o subtítulo "Bem-vindo, X" em `< xl` (já está) e encurtar botão "Personalizar" (já está).

### 3. Cards — adicionar breakpoint intermediário `lg:`
Hoje só temos `base` e `xl:`. Vou introduzir variantes `lg:` (1024–1279) **e revisar `xl:` para 1280–1535** mantendo `2xl:` como o luxo atual. Cards afetados:

- **`Visao360Card`**: alturas das barras (`h-1.5 lg:h-2 2xl:h-2.5`), padding e tamanho da caixa "Projeção Receita". Reduzir `flex: 1.3` → `flex: 1.1` em `lg`.
- **`DashboardMetaCard`**: já usa `useBreakpoint` para o `radialSize`. Adicionar tamanho intermediário (lg=160, xl=190, 2xl=230) e reduzir paddings do footer em `lg`.
- **`TotalRecebidoCard`**: reduzir `text-[26px]` para `text-[22px]` em `lg`, padding do header dos filtros, garantir altura mínima do gráfico (`min-h-[140px]`).
- **`ParcelasProgramadasCard`**: já tem coluna "Credor" oculta em `< xl`. Adicionar `truncate` no nome, reduzir paddings em `lg`, garantir scroll interno (já existe — só conferir com nova altura).
- **`KpisGridCard`**: reduzir o número gigante (`text-[34px] xl:text-[34px] 2xl:text-[42px]` → adicionar `lg:text-[28px]`).
- **`AgendamentosHojeCard`**: revisar para igual altura.

### 4. Comportamento abaixo de `lg` (tablet/mobile)
- Atualmente vira `grid-cols-1` sem altura definida. Vou:
  - Remover `h-full min-h-0 overflow-hidden` no container raiz quando `< lg`.
  - Definir altura mínima por card (`min-h-[260px]`) para empilhamento utilizável.

### 5. Sem mudanças de regra de negócio
Apenas tokens visuais, classes Tailwind e estrutura de grid. Nenhuma RPC, query, ou dado tocado.

## Detalhes técnicos

```text
Breakpoints alvo (Tailwind padrão):
  sm  < 640
  md  640–767
  lg  1024–1279   ← novo tier de estilos
  xl  1280–1535   ← refinado
  2xl ≥ 1536      ← mantém estilo atual

Grid principal:
  base (mobile/tablet) : grid-cols-1, rows auto, scroll vertical
  lg                    : grid-cols-12, rows auto (cards com min-h)
  xl/2xl                : grid-cols-12, rows minmax(0,1fr) minmax(0,1.4fr), sem scroll
```

```text
Arquivos editados:
  src/pages/DashboardPage.tsx
  src/components/dashboard/Visao360Card.tsx
  src/components/dashboard/DashboardMetaCard.tsx
  src/components/dashboard/TotalRecebidoCard.tsx
  src/components/dashboard/KpisGridCard.tsx
  src/components/dashboard/ParcelasProgramadasCard.tsx
  src/components/dashboard/AgendamentosHojeCard.tsx
```

## Validação
Após implementar, verifico nos viewports: 1920×1080, 1600×900, 1440×900, 1366×768, 1280×800, 1024×768 e mobile 390×844 — confirmando que nada estoura nem rola horizontalmente.
