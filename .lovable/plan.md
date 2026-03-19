

# Correção: Widget Flutuante — Botões não funcionam + Minimizar não aparece

## Diagnóstico

O problema é que o `onMouseDown={handleMouseDown}` está no div do header inteiro, e chama `e.preventDefault()`. Como os botões (Minimizar, Fechar) são filhos desse div, quando o usuário clica neles:

1. O evento `mouseDown` do header dispara **primeiro** (event bubbling)
2. `isDragging.current = true` é ativado
3. `e.preventDefault()` bloqueia o click do botão
4. O botão nunca recebe o evento de click

## Correção

**Arquivo**: `src/hooks/useAtendimentoModal.tsx`

1. **Adicionar `e.stopPropagation()`** em todos os `onClick` dos botões (Minimize, Maximize, Close) para impedir que o drag handler capture o click
2. **Modificar `handleMouseDown`** para ignorar clicks em botões — checar se `e.target` é um elemento interativo (button, svg, path) e não iniciar drag nesses casos
3. Garantir que o header mostra corretamente os botões Minimizar + Fechar quando expandido, e Expandir + Fechar quando minimizado

### Mudança concreta no `handleMouseDown`:
```typescript
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  // Don't start drag if clicking on interactive elements
  const target = e.target as HTMLElement;
  if (target.closest("button")) return;
  isDragging.current = true;
  dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  e.preventDefault();
}, [position]);
```

### Nos botões, adicionar `onMouseDown={e => e.stopPropagation()}`:
```tsx
<Button ... onClick={handleMinimize} onMouseDown={e => e.stopPropagation()}>
<Button ... onClick={closeAtendimento} onMouseDown={e => e.stopPropagation()}>
<Button ... onClick={handleExpand} onMouseDown={e => e.stopPropagation()}>
```

Isso resolve ambos os problemas:
- Os botões passam a funcionar (clicks não são interceptados pelo drag)
- O minimizar aparece e funciona corretamente

