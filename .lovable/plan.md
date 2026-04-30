## Modernizar painel de Respostas Rápidas no WhatsApp

Reformular o popover do botão Zap (Respostas Rápidas) e o dropdown que aparece ao digitar `/` no `ChatInput`, deixando-os com visual mais moderno e com **barra de rolagem funcional** — hoje o `ScrollArea` está com `max-h-*` mas sem altura fixa, então quando há muitos atalhos a rolagem não aparece corretamente.

### Mudanças no `src/components/contact-center/whatsapp/ChatInput.tsx`

**1. Popover do botão Zap (lista completa)**
- Largura aumentada de `w-[300px]` para `w-[360px]`.
- **Header moderno**: ícone `Sparkles` em fundo arredondado laranja (cor primária da marca), título "Respostas Rápidas" em destaque, contador discreto à direita ("12 atalhos").
- **Campo de busca** com ícone `Search` para filtrar por atalho, categoria ou conteúdo. Estado `qrSearch` local, dedup com `useMemo`.
- **ScrollArea com altura fixa** `h-[360px]` (em vez de `max-h-[250px]`), garantindo a barra de rolagem sempre que ultrapassar.
- **Cards modernizados**:
  - Hover com barra lateral colorida em `primary` (4px) que aparece ao passar o mouse.
  - Atalho `/{shortcut}` em chip arredondado `bg-primary/10 text-primary` com ícone `Hash`.
  - Categoria como badge minimalista `bg-muted/60 text-[10px]`.
  - Conteúdo em `text-foreground/80` com `line-clamp-2`, espaçamento `py-2.5 px-3`.
  - Separadores sutis (`border-border/40`).
- **Empty state**: quando a busca não retorna nada, mostrar mensagem central "Nenhuma resposta encontrada".
- **Footer**: dica discreta "Digite `/` no chat para acesso rápido".

**2. Dropdown inline ao digitar `/`**
- Aplicar o **mesmo estilo de cards** do popover (chip do atalho, badge de categoria, line-clamp do conteúdo).
- Trocar `max-h-[200px]` por `h-[240px]` para a barra de rolagem aparecer.
- Adicionar header compacto "Respostas Rápidas · {n} resultado(s)".
- Sombra mais elegante (`shadow-xl`) e borda com leve glow `ring-1 ring-primary/10`.

**3. Tokens semânticos**
- Tudo usando tokens do design system (`primary`, `muted`, `foreground`, `border`, `accent`) — sem cores hardcoded. Compatível com dark mode automaticamente.

### Sem mudanças
- Lógica de filtragem ao digitar `/`, seleção da resposta, inserção no textarea — preservadas.
- Fonte de dados (`quickReplies` prop) — preservada.
- Nenhuma alteração de schema/RLS.

### Arquivo afetado
- `src/components/contact-center/whatsapp/ChatInput.tsx`
