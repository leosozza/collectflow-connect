
Aplicar o `CraftButton` no botão "Mais informações do devedor" no `ClientDetailHeader`, mantendo o comportamento de toggle do collapsible e a rotação do chevron quando aberto.

### Mudanças
**Arquivo**: `src/components/client-detail/ClientDetailHeader.tsx`

1. Importar `CraftButton`, `CraftButtonLabel`, `CraftButtonIcon` de `@/components/ui/craft-button`.
2. Trocar o `<Button variant="ghost">` que está dentro do `CollapsibleTrigger asChild` por um `CraftButton` com `asChild`:
   - `CraftButtonLabel`: texto "Mais informações do devedor" / "Menos informações"
   - `CraftButtonIcon`: ícone `ChevronDown` com classe condicional `rotate-180` quando aberto (mantém a transição atual)
3. Manter `size="sm"` para harmonizar com o tamanho usado nas abas.
4. Preservar a largura/alinhamento atual (provavelmente `w-full` ou auto-width — confirmar no arquivo) para não quebrar o layout do header.

### Resultado visual
- Mesma animação de bolha expandindo no hover já aplicada nas abas.
- Chevron continua girando 180° ao abrir o collapsible.
- Consistência visual entre os 6 tabs e o botão de expandir informações.
