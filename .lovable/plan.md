

## Problema
No `PhoneList.tsx`, o container de ações usa `ml-auto`, que empurra WhatsApp/editar/inativar para a extrema direita do popover (460px de largura). Resultado: espaço enorme entre o número curto e os ícones.

## Solução
Remover o `ml-auto` do cluster de ações para que os ícones fiquem **colados ao número**, com apenas um pequeno gap. O `ml-auto` migra para um spacer invisível ou simplesmente é eliminado — os ícones passam a seguir naturalmente o fluxo flex logo após o número.

## Mudança em `src/components/client-detail/PhoneList.tsx`

**Linha ~226** — trocar:
```tsx
<div className="flex items-center shrink-0 ml-auto -space-x-0.5">
```
por:
```tsx
<div className="flex items-center shrink-0 ml-1 -space-x-0.5">
```

E também remover a `div` wrapper de `w-5` em volta do WhatsAppDot, renderizando o ícone só quando existe (sem reservar espaço fixo):
```tsx
{wa && <WhatsAppDot className="w-3.5 h-3.5 text-green-600 mr-0.5" />}
```

Assim:
- Número, WhatsApp (se houver), editar e inativar ficam todos juntos, com gap mínimo (`ml-1` = 4px) após o número.
- Sem espaço reservado para WhatsApp quando o número não tem WhatsApp.
- Layout enxuto, alinhado à esquerda junto do número.

## Resultado esperado
```
🔥  (11) 96551-9515  🟢 ✏️ 🚫
○   (81) 98489-1623  ✏️ 🚫
+ Adicionar telefone
```

