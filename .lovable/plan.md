
Substituir os `TabsTrigger` das 6 abas (Títulos em Aberto, Acordo, Histórico, Documentos, Assinatura, Anexos) em `ClientDetailPage.tsx` por uma versão animada estilo CraftButton, **mantendo tamanho, layout e organização atuais**.

### Passos

1. **Criar `src/components/ui/craft-button.tsx`** — componente com `CraftButton`, `CraftButtonLabel`, `CraftButtonIcon`. Usa `group` no root para permitir animações coordenadas no hover (label desliza levemente, ícone rotaciona/desliza).

2. **Editar `src/pages/ClientDetailPage.tsx`** — nas 6 `TabsTrigger`:
   - Adicionar `group` na className (preservando classes existentes de tamanho/cor/active state).
   - Envolver o texto da aba em `<span>` com transição sutil (`transition-transform duration-300 group-hover:-translate-x-0.5`).
   - Adicionar um ícone `ArrowUpRight` (size-3) ao lado, com `transition-transform duration-500 group-hover:rotate-45`, visível apenas em hover via `opacity-0 group-hover:opacity-100` para não alterar layout em estado normal.

### Detalhes técnicos
- **Sem mudança de tamanho**: ícone usa `size-3` e ocupa espaço fixo (`ml-1`), mas `opacity-0` mantém visualmente igual ao estado atual.
- **Sem mudança de organização**: ordem das abas, contadores (badges) e classes ativas (`data-[state=active]`) preservados.
- **Aplicado apenas às 6 abas listadas** — outras `TabsTrigger` (se houver) ficam inalteradas.
- **Não mexer em**: cabeçalho, botões de ação, formalizar acordo, "Mais informações do devedor".
