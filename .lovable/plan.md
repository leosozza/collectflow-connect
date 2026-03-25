
Corrigir o datepicker em `src/components/client-detail/AgreementInstallments.tsx` mudando a forma como o modo de edição é acionado.

## Diagnóstico
O problema não está mais no `Popover` em si. O calendário já usa:
- `onOpenAutoFocus={(e) => e.preventDefault()}`
- `onInteractOutside` para fechar manualmente
- `pointer-events-auto` no `Calendar`

O fechamento rápido continua porque o estado `editingDateIdx` é ativado diretamente dentro do `DropdownMenuItem`. Como o item está dentro de um menu Radix, o clique de seleção fecha o dropdown e gera uma sequência de foco/interação que desmonta ou desestabiliza o popover logo em seguida.

## Correção proposta
### 1) Abrir o editor de data após o fechamento do menu
Em vez de:
```tsx
<DropdownMenuItem onClick={() => setEditingDateIdx(idx)}>
```

Trocar para uma abertura adiada, por exemplo com `requestAnimationFrame` ou `setTimeout(0)`, para que o dropdown termine de fechar antes de montar o `Popover` da linha:
```tsx
onClick={() => {
  requestAnimationFrame(() => setEditingDateIdx(idx));
}}
```

Isso separa os dois ciclos de UI:
- primeiro o menu fecha
- depois o calendário abre

### 2) Evitar que a seleção do item dispare fluxo indesejado do menu
Usar o evento apropriado do Radix no item (`onSelect`) com `preventDefault()` antes de agendar a abertura:
```tsx
<DropdownMenuItem
  onSelect={(e) => {
    e.preventDefault();
    requestAnimationFrame(() => setEditingDateIdx(idx));
  }}
>
```

Esse é o ajuste mais importante, porque o item “Editar Data” hoje depende do comportamento padrão do dropdown.

### 3) Manter o popover controlado como está
Preservar a abordagem atual do calendário:
- `Popover open`
- `onOpenAutoFocus` prevenido
- `onInteractOutside` fechando com `setEditingDateIdx(null)`
- `Calendar` com `className={cn("p-3 pointer-events-auto")}`

### 4) Ajuste opcional de robustez
Se ainda houver instabilidade, substituir o `PopoverTrigger` visual por um botão neutro/read-only ou até renderizar o `PopoverContent` ancorado sem depender do trigger clicável, já que a abertura é programática. Mas isso deve ser plano B; a correção principal deve resolver.

## Arquivo afetado
- `src/components/client-detail/AgreementInstallments.tsx`

## Resultado esperado
Ao clicar em “Editar Data”:
- o menu de ações fecha normalmente
- o calendário abre em seguida
- o componente permanece aberto tempo suficiente para selecionar a nova data
- o fechamento só acontece ao escolher uma data ou clicar fora
