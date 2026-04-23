## Objetivo

Padronizar visualmente o Dashboard no estilo RIVO (clean, elegante, neutro com acento laranja), corrigindo:

1. **Quebra de padrão dos KPIs**: a coluna do meio usa `variant="gradient"` (cards laranja sólido), enquanto as colunas 1 e 3 são neutros — vira um "bloco laranja" no meio.
2. **Desalinho vertical**: card "Agendados" vazio fica com ~150 px enquanto Meta e Parcelas Programadas têm ~600 px.
3. **Tipografia / iconografia mista** entre KPIs e cards funcionais.
4. **Headers e bordas** levemente diferentes entre os 3 cards funcionais.

## Mudanças

### 1. `src/pages/DashboardPage.tsx`

- Remover `variant="gradient"` dos 3 KPIs da coluna 2 (Colchão, Total 1ª Parcela, Total Negociado). Os 9 KPIs do topo passam a usar o mesmo estilo neutro com ícone laranja em fundo `bg-primary/10`.
- Padronizar gaps: grid principal `gap-5`, KPIs internos `gap-3`.
- Adicionar `min-h-[520px]` na coluna que contém Agendados/Meta/Parcelas, garantindo altura igual entre os 3 cards funcionais.
- Botões "Relatórios" e "Analytics" do header com `text-xs` para casar com filtros.

### 2. `src/components/StatCard.tsx`

- Padronizar todos os KPIs com:
  - Título: `text-[11px] font-medium text-muted-foreground uppercase tracking-wide`
  - Valor: `text-xl font-bold text-foreground tracking-tight`
  - Ícone: caixa `w-8 h-8 rounded-lg`, ícone `w-4 h-4` — sempre laranja (`text-primary` em `bg-primary/10`), exceto `received` (verde) e `broken` (vermelho), que mantêm cor semântica para sinalização rápida.
  - Borda `border-border/60`, hover `hover:border-primary/30 hover:shadow-md transition-all`.

### 3. `src/components/dashboard/ScheduledCallbacksCard.tsx`

- Adicionar `h-full flex flex-col` no card raiz.
- Empty state ocupa `flex-1` com ícone `Clock` discreto e mensagem centralizada vertical+horizontal.
- Header: ícone `w-4 h-4 text-primary`, título `text-sm font-semibold text-foreground`, padding `px-4 py-3`, border-bottom `border-border/60`.

### 4. `src/components/dashboard/DashboardMetaCard.tsx` e bloco "Parcelas Programadas" inline em `DashboardPage.tsx`

- Mesmo padrão de header dos cards funcionais (ícone + título + padding + border).
- `h-full flex flex-col` para esticar até a altura da coluna.
- Footer com cores e padding alinhados.

## Resultado esperado

- 9 KPIs do topo idênticos (neutros com acento laranja), formando uma faixa horizontal limpa.
- 3 cards funcionais (Agendados, Meta, Parcelas Programadas) com altura mínima igual e rodapés alinhados.
- Tipografia, ícones, padding e bordas consistentes em todo o Dashboard.
- Identidade RIVO: laranja como acento sutil, fundo claro, contraste alto, estética clean.

## Arquivos afetados

- `src/pages/DashboardPage.tsx`
- `src/components/StatCard.tsx`
- `src/components/dashboard/ScheduledCallbacksCard.tsx`
- `src/components/dashboard/DashboardMetaCard.tsx`

Aprove para eu aplicar as alterações.
