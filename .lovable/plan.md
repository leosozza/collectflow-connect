## Objetivo

Reorganizar a primeira linha do Dashboard para ficar **exatamente** como na imagem de referência: 3 cards lado a lado com larguras/alturas iguais — **Agendamentos** (esq), **Parcelas Programadas** (centro), **Meta do Mês** (dir) — e refazer o gráfico de Meta como um **velocímetro tricolor** (vermelho → amarelo → verde) com ponteiro animado.

Os demais cards (KPIs, Total Recebido, Quebra, Pendentes, Colchão) **mantêm o visual atual**, apenas ajustam-se para caber no novo padrão de altura do grid.

## Layout do grid

### Linha 1 (referência da imagem) — 3 colunas iguais
```text
┌──────────────────┬──────────────────┬──────────────────┐
│ Agendamentos     │ Parcelas Progr.  │ Meta do Mês      │
│ para Hoje        │ (HOJE / nav)     │ (gauge tricolor) │
└──────────────────┴──────────────────┴──────────────────┘
```

- Cada um ocupa **1 coluna × 1 linha** (3 slots horizontais).
- Altura fixa do slot: aumentar `auto-rows` para `minmax(180px, auto)` (hoje é 140px) para acomodar o gauge confortavelmente, igual à imagem.

### Linhas seguintes
- Demais blocos (KPIs Operacionais, Total Recebido, Quebra, Pendentes, Colchão) seguem o grid 3-col existente — **mesmo visual atual**, apenas respeitando a nova altura mínima do slot.

## Mudanças por arquivo

### 1. `src/hooks/useDashboardLayout.ts`
- Reordenar `DEFAULT_DASHBOARD_LAYOUT.order` para que a primeira linha seja exatamente: `agendamentos`, `parcelas`, `metas`.
- Bump versão storage: `v4` → `v5` para invalidar layouts salvos e aplicar a nova ordem padrão.

### 2. `src/pages/DashboardPage.tsx`
- `SPAN_CLASS`:
  - `agendamentos`: `col-span-1 row-span-1`
  - `parcelas`: **mudar de `md:col-span-2`** para `col-span-1 row-span-1` (uniforme com os outros dois).
  - `metas`: `col-span-1 row-span-1`
  - Demais permanecem como estão.
- Container do grid: aumentar altura mínima das linhas → `auto-rows-[minmax(180px,auto)]`.

### 3. `src/components/dashboard/MetaGaugeCard.tsx` (refatoração visual completa)
Substituir o gauge atual (radial laranja com gradiente) por **velocímetro tricolor** semelhante ao da imagem:

- **Semicírculo** com 3 segmentos contíguos:
  - Vermelho (`hsl(var(--destructive))`) de 0% a 33,33%
  - Amarelo (`hsl(48 96% 53%)`) de 33,33% a 66,66%
  - Verde (`hsl(142 71% 45%)`) de 66,66% a 100%
- **Ponteiro** preto/foreground triangular animado com `framer-motion`, gira de -90° (esquerda) a +90° (direita) conforme o `percent`.
- **Hub central** circular com furo interno (estilo relógio).
- **% no centro** abaixo do gauge.
- **Lado esquerdo** do componente: bloco textual com:
  - `R$ XX.XXX,XX` em destaque + label "Meta Recebimento"
  - `R$ XX.XXX,XX` em destaque + label "Realizado"
  - Linha pequena: `01/MM/AA à DD/MM/AA`
- Layout: `flex items-center justify-between` — texto à esquerda, gauge à direita, ocupando toda a largura/altura do card.

### 4. `src/components/dashboard/DashboardMetaCard.tsx`
- Remover o header com ícone Trophy (a imagem mostra só "Metas" como título sutil).
- Adicionar header simples: "**Metas**" no canto superior esquerdo, padding reduzido.
- O `MetaGaugeCard` ocupa o restante do card (`flex-1`).
- Reduzir `size` do gauge para se adequar ao slot (~`size={160}`).
- Manter toda a lógica de busca de meta (operador vs admin, `myGoal`/`allGoals`/`selectedProfile`) **inalterada**.

## Resultado esperado

- Primeira linha do dashboard idêntica à referência: 3 cards retangulares de mesmo tamanho.
- Meta do Mês passa a exibir velocímetro tricolor com ponteiro animado, valores `Meta Recebimento` e `Realizado` à esquerda e período abaixo.
- Demais cards mantêm visual original — apenas ganham altura mínima maior (180px) para uniformidade visual.
- Drag-and-drop continua funcionando; layouts antigos do localStorage são invalidados pelo bump `v4 → v5`.

## Restrições

- **Nenhuma** mudança em RPCs, queries, lógica de dados ou cálculo de percentual da meta.
- KPIs Operacionais (card 3-em-1 azul/verde/laranja) e demais blocos: **visual intacto**.
