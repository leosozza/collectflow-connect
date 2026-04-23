# Dashboard sem rolagem lateral — listas internas scrolláveis

## Objetivo
Eliminar a barra de rolagem da página `/dashboard`. Tudo deve caber em uma única tela. Apenas os blocos **Agendados** e **Parcelas Programadas** terão rolagem interna quando houver muitos itens.

## Mudanças

### 1. `src/pages/DashboardPage.tsx` — container fit-to-viewport
- Substituir `space-y-6 animate-fade-in` do wrapper raiz por `h-full flex flex-col gap-4 animate-fade-in min-h-0`, para o dashboard ocupar exatamente a altura do `<main>` do `AppLayout` (que já é `flex-1 overflow-auto`).
- Reduzir o cabeçalho para ficar mais condensado (sem alterar conteúdo): `gap-3` no header, `text-xl` no título.
- Trocar o grid principal:
  - De: `grid grid-cols-1 lg:grid-cols-3 gap-5` + colunas com `min-h-[520px]`.
  - Para: `flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4`, e cada coluna `flex flex-col gap-3 min-h-0` (sem `min-h-[520px]`).
- Stat cards do topo de cada coluna: manter o grid de 3 cards mas reduzindo a altura (ver item 3) para liberar espaço aos blocos inferiores.
- Bloco inferior de cada coluna (`Agendados`, `Meta`, `Parcelas Programadas`) recebe `flex-1 min-h-0 flex flex-col` para preencher o restante da altura disponível e permitir rolagem interna.

### 2. `src/components/dashboard/ScheduledCallbacksCard.tsx`
- Wrapper raiz: trocar `h-full flex flex-col` para `h-full min-h-0 flex flex-col` (já está h-full, falta `min-h-0`).
- A `div` da lista de callbacks já tem `overflow-auto flex-1` — manter.
- O empty state hoje é `flex-1 flex flex-col items-center justify-center` — manter (preserva o tamanho mesmo sem agendamentos).

### 3. `src/components/StatCard.tsx` — versão condensada
- Reduzir padding interno (`p-3` em vez de `p-4`), altura de ícone (`w-7 h-7` em vez de `w-8 h-8`), valor (`text-lg` em vez de `text-xl`) e título (`text-[10px]`).
- Objetivo: cada stat card ocupar ~64–72px de altura, somando ~210px para os 3 cards de cada coluna e deixando o bloco inferior com altura suficiente para listar 4–6 linhas sem rolar.

### 4. Bloco "Parcelas Programadas" (dentro de `DashboardPage.tsx`)
- Wrapper já é `flex-1 flex flex-col`. Adicionar `min-h-0` para que o `overflow-auto flex-1` da tabela funcione corretamente.
- Header já tem `flex-shrink-0` implícito; nenhuma mudança no conteúdo.

### 5. `DashboardMetaCard.tsx`
- Wrapper já é `h-full flex flex-col`. Adicionar `min-h-0` no wrapper e trocar o conteúdo central de `py-12` para `py-6` para reduzir altura mínima quando não há meta.

## Resultado esperado
- Página `/dashboard` cabe em 1432×948 sem barra lateral.
- "Agendados" e "Parcelas Programadas" mostram scrollbar **interna** somente quando a lista excede a altura do bloco.
- Stat cards do topo ficam visualmente condensados, alinhados nas três colunas.
- Layout permanece responsivo: em telas menores que `lg`, as colunas empilham e o `<main>` do AppLayout volta a rolar normalmente (comportamento mobile esperado).

## Arquivos editados
- `src/pages/DashboardPage.tsx`
- `src/components/StatCard.tsx`
- `src/components/dashboard/ScheduledCallbacksCard.tsx`
- `src/components/dashboard/DashboardMetaCard.tsx`
