

# 3 Ajustes: Ranking, Kanban e Paginação

## 1. Remover MiniRanking do Dashboard

**Arquivo:** `src/pages/DashboardPage.tsx`
- Remover import do `MiniRanking` (linha 16)
- Remover `<MiniRanking />` (linha 271)

O ranking fica exclusivamente em `/gamificacao`.

## 2. Kanban com colunas lado a lado (scroll horizontal)

**Arquivo:** `src/components/carteira/CarteiraKanban.tsx`
- Trocar o layout de `grid` para `flex` com scroll horizontal (`overflow-x-auto`)
- Cada coluna com largura fixa (`min-w-[280px] w-[300px]`) para ficarem lado a lado
- Container com `flex-nowrap` para nunca quebrar linha

## 3. Paginação de 100 em 100 nos cards do Kanban

**Arquivo:** `src/components/carteira/CarteiraKanban.tsx`
- Adicionar estado `page` por coluna (usando `Record<string, number>`)
- Exibir apenas 100 clientes por vez (`slice(page*100, (page+1)*100)`)
- Setas `<` `>` no header de cada coluna para navegar entre páginas
- Mostrar indicador "1-100 de 350" no header

