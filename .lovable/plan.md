## Objetivo

Tornar o botão flutuante "RIVO Suporte" arrastável e mais discreto visualmente.

## Mudanças

### 1. Drag & drop livre
- Usar `framer-motion` (já no projeto) com `drag` no botão FAB.
- Limitar dentro da viewport (`dragConstraints`) com margem segura.
- Persistir a posição em `localStorage` (`rivo-support-fab-pos`) para sobreviver entre sessões.
- Distinguir clique de arrasto: se o ponteiro moveu mais do que ~5px durante o press, é drag e não dispara `onClick` (`onDragStart` seta um flag, `onPointerUp` consulta o flag antes de abrir o chat).

### 2. Visual translúcido com hover colorido
- Estado padrão: `bg-primary/30 text-primary-foreground/80` + `backdrop-blur-sm`.
- Hover: `hover:bg-primary hover:text-primary-foreground` (volta ao 100%).
- Sombra mais sutil (`shadow-md`) que cresce no hover (`hover:shadow-xl`).
- Quando o chat está aberto, mantém o estilo atual `bg-muted` (sem mudança).
- Cursor: `cursor-grab` em repouso, `cursor-grabbing` enquanto arrasta.

### 3. Painel de chat acompanha a posição
- O painel (que hoje usa `bottom-24 right-6`) passa a se posicionar relativamente ao FAB: ancorado acima do botão, ajustado para não sair da tela (se o FAB estiver no topo, abre para baixo; se estiver à esquerda, alinha à esquerda).

## Arquivo alterado
- `src/components/support/SupportFloatingButton.tsx` (apenas o JSX do FAB, o wrapper de posição e o cálculo do anchor do painel).

Sem mudanças de banco, sem novos componentes.

**Posso aplicar?**