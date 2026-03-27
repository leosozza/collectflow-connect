

# Plano: Corrigir tooltips do Analytics que não abrem

## Problema

O componente `InfoTooltip` usa `asChild` no `TooltipTrigger` passando diretamente um SVG (`MessageCircle`). Elementos SVG não recebem eventos de pointer de forma confiável como elementos HTML. Além disso, `cursor-default` remove a indicação visual de que o ícone é interativo.

## Correção

Envolver o ícone em um `<button>` para garantir que o trigger funcione como elemento HTML interativo:

```tsx
const InfoTooltip = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="inline-flex items-center justify-center">
        <MessageCircle className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[220px] text-xs">
      {text}
    </TooltipContent>
  </Tooltip>
);
```

Mudanças: `cursor-default` → `cursor-help`, SVG envolto em `<button>`.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/AnalyticsPage.tsx` | Linha 75-84: envolver ícone em `<button>` no `InfoTooltip` |

