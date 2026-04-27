## Adicionar botão de fechar (X) no toast de "Nova versão disponível"

O toast usa o `sonner` (importado em `src/components/system/UpdateButton.tsx`). O `sonner` já suporta um botão "X" nativo via a opção `closeButton: true` por toast individual.

## Alteração

Em `src/components/system/UpdateButton.tsx`, na chamada `toast(...)` (linha 121), adicionar `closeButton: true` às opções:

```ts
toast("Nova versão disponível", {
  description: "Clique para atualizar agora",
  duration: Infinity,
  closeButton: true, // ← novo
  action: {
    label: "Atualizar",
    onClick: () => { void handleClick(); },
  },
});
```

Isso renderiza um "X" no canto do toast permitindo que o operador feche o aviso sem atualizar. Como o `toastShownRef.current` já é setado para `true`, o aviso não reaparece na mesma sessão (só será mostrado de novo se uma versão ainda mais nova for detectada — comportamento desejado).

## Arquivo afetado

- `src/components/system/UpdateButton.tsx` (1 linha adicionada)
