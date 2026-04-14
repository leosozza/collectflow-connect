

# Correção: Calendário se movendo ao selecionar data

## Problema

O `DatePickerField` no `MaxListPage.tsx` usa um `Popover` com o `Input` como trigger. Quando o usuário seleciona uma data no calendário:

1. O `onChange` atualiza o valor → re-render do input → o Popover recalcula posição
2. Dentro do `Dialog` (que usa CSS `transform`), o posicionamento do Popover fica instável porque o Radix calcula coordenadas relativas ao viewport, mas o transform do Dialog cria um novo contexto de posicionamento

## Solução

Alterar o `DatePickerField` para usar `PopoverContent` com `sideOffset` e adicionar `onOpenAutoFocus={(e) => e.preventDefault()}` para evitar que o foco force scroll/reposicionamento. Além disso, adicionar `modal={true}` ao Popover dentro do Dialog para que ele se comporte corretamente em contextos empilhados.

### Arquivo: `src/pages/MaxListPage.tsx`

Na função `DatePickerField`:

1. Adicionar `modal` prop ao `Popover` para funcionar corretamente dentro do Dialog
2. Adicionar `onOpenAutoFocus={e => e.preventDefault()}` no `PopoverContent` para evitar reposicionamento
3. Usar `side="bottom"` e `sideOffset={4}` explícitos no `PopoverContent`
4. Adicionar `avoidCollisions={false}` ou `collisionPadding` para estabilizar posição

Mudança principal no `PopoverContent`:
```tsx
<PopoverContent 
  className="w-auto p-0" 
  align="start" 
  side="bottom"
  sideOffset={4}
  onOpenAutoFocus={(e) => e.preventDefault()}
>
```

## Resultado

O calendário abre fixo abaixo do input e não se move ao selecionar datas, tanto nos filtros quanto no dialog de "Sincronizar por Período".

## Arquivo alterado
- `src/pages/MaxListPage.tsx` (apenas o componente `DatePickerField`)

