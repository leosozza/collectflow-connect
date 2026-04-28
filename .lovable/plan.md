## Objetivo

Transformar a personalização do Dashboard em duas coisas distintas:

1. **Diálogo "Personalizar"** → apenas toggles de visibilidade (mostrar/ocultar cards). Sem reordenação.
2. **Reordenação dos cards** → feita diretamente no Dashboard, **arrastando e soltando** cada card para qualquer posição livre na grade.

---

## Como vai funcionar (visão do usuário)

- Cada card do Dashboard ganha um **handle de arrastar** (ícone de "grip" no canto, visível ao passar o mouse).
- O usuário clica no handle e **arrasta o card para qualquer posição** entre os outros cards. Ao soltar, os demais se reorganizam.
- A nova ordem é **salva automaticamente** no navegador (por usuário), igual ao layout atual.
- Botão **"Personalizar"** abre um diálogo enxuto com 5 switches:
  - KPIs superiores
  - Parcelas Programadas
  - Total Recebido
  - Metas
  - Agendamentos para Hoje
- Botão **"Restaurar padrão"** continua existindo dentro do diálogo (volta visibilidade + ordem ao default).

---

## Mudanças técnicas

### 1. Layout em lista única arrastável

Hoje os cards estão presos em 3 colunas fixas (`lg:col-span-3 / 6 / 3`) com posições rígidas. Para permitir drag-and-drop livre, vamos mudar para uma **grade única de 12 colunas** onde cada card declara sua largura preferida (`colSpan`):

| Card             | colSpan padrão |
| ---------------- | -------------- |
| KPIs             | 3              |
| Metas            | 3              |
| Agendamentos     | 3              |
| Total Recebido   | 6              |
| Parcelas         | 6              |

A ordem dos cards passa a ser **uma lista linear** (`order: DashboardBlockId[]` com os 5 ids, incluindo `kpisTop`), e o CSS Grid com `auto-flow: dense` posiciona cada card na próxima vaga disponível respeitando seu `colSpan`. Isso dá a sensação de "encaixe livre" sem precisar de coordenadas X/Y manuais.

### 2. Biblioteca de drag-and-drop

Usar **`@dnd-kit/core` + `@dnd-kit/sortable`** (já é o padrão de DnD no ecossistema React/shadcn, leve, acessível, suporta teclado). Adicionar como dependência.

- `DndContext` envolve a grade.
- `SortableContext` recebe `layout.order`.
- Cada card é um `useSortable` com handle dedicado (ícone `GripVertical` do lucide).
- `onDragEnd` reordena o array e chama `setLayout({...layout, order: newOrder})`.

### 3. Atualização de `useDashboardLayout`

- Incluir `kpisTop` no array `order` (hoje só tem os 4 da coluna direita).
- `DEFAULT_DASHBOARD_LAYOUT.order` = `["kpisTop", "metas", "agendamentos", "totalRecebido", "parcelas"]` (reproduz o layout visual atual aproximadamente).
- Bumpar a chave de storage para `rivo:dashboard-layout:v2` para evitar conflito com o formato antigo (usuários atuais começam com o default novo).
- Função `sanitize` passa a aceitar os 5 ids.

### 4. Simplificação de `CustomizeDashboardDialog`

Remover toda a UI de setas ↑/↓ e ordenação. Manter apenas:
- 5 linhas com label + Switch (uma para cada bloco).
- Botões: Restaurar padrão / Cancelar / Salvar.

### 5. Refatoração de `DashboardPage.tsx`

- Substituir o grid de 3 colunas por **uma única grade** `grid-cols-12` que renderiza `layout.order.filter(id => layout.visible[id]).map(...)`.
- Cada item vira um wrapper `<SortableCard id={id} colSpan={...}>` que renderiza o componente correspondente.
- O handle de arrastar fica num pequeno botão flutuante no canto superior direito de cada card (visível em hover, com `cursor-grab`).

### 6. Responsividade

- Em telas `< lg`, força `colSpan = 12` para todos (uma coluna empilhada). Drag-and-drop continua funcionando para reordenar a pilha.

---

## Arquivos afetados

- `src/hooks/useDashboardLayout.ts` — incluir `kpisTop` em `order`, novo default, bump de versão da chave de storage.
- `src/components/dashboard/CustomizeDashboardDialog.tsx` — simplificar para apenas toggles.
- `src/pages/DashboardPage.tsx` — nova grade única + DnD.
- `package.json` — adicionar `@dnd-kit/core` e `@dnd-kit/sortable`.

Nenhuma mudança de banco, RPC ou regra de negócio. Persistência continua em `localStorage` por usuário.

---

Posso prosseguir?