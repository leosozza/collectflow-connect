# Refinar arrasto do botão flutuante de suporte

## Problema
Mesmo após o último ajuste, ao arrastar o FAB de suporte (`SupportFloatingButton`) lateralmente ele ainda some da tela. A causa é que o `framer-motion` aplica internamente um `transform: translate(x, y)` durante o `drag`, que se soma ao `left`/`top` que estamos atualizando em `onDrag`. Esse deslocamento duplicado empurra o botão para fora da viewport, e como `onDragEnd` não reseta o transform de forma síncrona, ele não retorna.

## Solução
Abandonar o sistema `drag` do framer-motion para esse botão e implementar o arrasto com **pointer events nativos** (`onPointerDown` + `pointermove` + `pointerup` com `setPointerCapture`). A posição passa a ser 100% controlada por `left`/`top` no estado `pos`, sem nenhum `transform` concorrente. Isso garante:

- Clamp rígido aos limites da viewport em todas as direções (esquerda, direita, topo, base).
- Funciona com mouse, toque e caneta (pointer capture).
- Diferenciação clara entre clique e arrasto via threshold de 4px (não dispara `setOpen` durante drag).
- Sem dependência de `info.point` do framer (que pode falhar em iframes/embed do preview do Lovable).

## Arquivo afetado
- `src/components/support/SupportFloatingButton.tsx` — trocar `<motion.button drag …>` por `<button>` nativo com handler `onPointerDown` que registra listeners temporários para `pointermove` e `pointerup`. Mantém `pos` no estado, persistência em `localStorage` e o `panelStyle` calculado a partir de `pos` (sem alterações).

## Detalhes técnicos
- `onPointerDown` captura `clientX/Y` iniciais e `pos` inicial; usa `setPointerCapture` para garantir recebimento dos eventos mesmo se o cursor sair do botão.
- `onMove`: calcula `dx/dy`, ativa flag de drag após 4px de movimento, atualiza `setPos` com clamp `[FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN]` (idem para Y).
- `onUp`/`onCancel`: remove listeners, libera pointer capture, reseta `isDragging` e `draggedRef` (com `setTimeout` de 50ms para suprimir o `click` subsequente quando houve drag).
- `onClick`: se `draggedRef.current` for `true`, ignora; caso contrário, alterna `open`.
- Adicionar classe `touch-none select-none` para evitar scroll/seleção em mobile durante o drag.
- Remover `animate={{ x: 0, y: 0 }}` e `motion.button` — não há mais transform a resetar.

## Critérios de aceite
- Arrastar para qualquer direção mantém o botão totalmente visível, parando exatamente na borda da viewport (com margem de 16px).
- Clicar (sem mover) abre/fecha o painel normalmente.
- A posição persiste após reload (já coberto pelo `localStorage` existente).
- Funciona em desktop e mobile.
