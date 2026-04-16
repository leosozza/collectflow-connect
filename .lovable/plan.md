

# Corrigir scrollbar visível no modal "Formalizar Acordo"

## Problema

O `DialogContent` (pai) tem `overflow-y-auto` e o `AgreementCalculator` (filho) também tem `overflow-y-auto`. O scroll acontece no `DialogContent`, mas como ele é o container do dialog do shadcn, a scrollbar fica na borda extrema e pode ser pouco visível ou conflitar com o estilo do dialog.

## Solução

Mover a responsabilidade do scroll para **dentro** do `AgreementCalculator`, removendo `overflow-y-auto` do `DialogContent` e garantindo que o componente interno tenha altura máxima e scrollbar visível.

### Alterações

**1. `src/pages/ClientDetailPage.tsx` (linha 505)**
- Trocar `overflow-y-auto` por `overflow-hidden` no `DialogContent` — o dialog não scrolla, quem scrolla é o conteúdo interno

**2. `src/pages/AtendimentoPage.tsx` (linha 722)**
- Mesma alteração: `overflow-y-auto` → `overflow-hidden`

**3. `src/components/client-detail/AgreementCalculator.tsx` (linha 544)**
- Adicionar classes de scrollbar visível com Tailwind: `scrollbar-thin` ou usar CSS customizado para forçar a scrollbar sempre visível
- Trocar `overflow-y-auto` por `overflow-y-scroll` para a barra aparecer permanentemente
- Resultado: `className="flex flex-col overflow-y-scroll flex-1 min-h-0 gap-2 pr-1"`

