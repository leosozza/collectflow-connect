# Corrigir layout do Dashboard no preview do Lovable

## Problema

No preview do Lovable o viewport é ~1259px de largura. O grid principal do `DashboardPage` usa o breakpoint `xl:` do Tailwind, que só ativa a partir de 1280px. Por isso o layout "quebra" e empilha os blocos (1ª imagem), em vez de exibir as 3 colunas como no 2º anexo.

A 2ª imagem (referência) mostra o layout correto:
- Coluna 1 (≈3/12): Meta do Mês + Agendamentos para Hoje
- Coluna 2 (≈6/12): Total Recebido (gráfico) + Parcelas Programadas
- Coluna 3 (≈3/12): Grid 2x3 de KPIs (Acionados, Acordos Dia, Acordos Mês, Quebra, Pendentes, Colchão)

Esse é exatamente o layout já definido nas classes `xl:col-span-*` / `xl:row-start-*`. Só precisa ativar antes.

## Mudança

Em `src/pages/DashboardPage.tsx`, no container do grid e em cada `<section>` dos blocos visíveis, substituir o prefixo `xl:` por `lg:` (ativa em ≥1024px). Remover o `md:col-span-2` intermediário onde ele conflita, mantendo o comportamento mobile (`grid-cols-1`).

Especificamente:
- Wrapper: `grid-cols-1 md:grid-cols-2 xl:grid-cols-12 xl:grid-rows-[...]` → `grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)_minmax(0,1.4fr)]`
- Cada `<section>`: trocar `xl:` por `lg:` nas classes `col-span`, `col-start`, `row-start`. Remover os `md:col-span-2` (já que pulamos direto de 1 col para 12 cols).

## Resultado esperado

- <1024px: tudo empilhado em 1 coluna (mobile).
- ≥1024px (inclui o preview de 1259px): layout idêntico ao 2º anexo, com 3 colunas e 2 linhas.

## Arquivos afetados

- `src/pages/DashboardPage.tsx` (somente classes do grid; nenhuma lógica alterada)

Nenhuma mudança em backend, RPCs ou outros componentes.