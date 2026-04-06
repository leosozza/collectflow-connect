

# Plano: Substituir SimpleCalculator pela identidade visual do prompt

## O que muda

Reescrever `src/components/client-detail/SimpleCalculator.tsx` usando o design do componente fornecido (fundo escuro, botões com `bg-gray-700`/`bg-orange-500`/`bg-gray-500`, histórico, backspace, display com operação pendente). Manter o wrapper `Popover` existente para integração no `AgreementCalculator`.

## Alteração

**Arquivo único**: `src/components/client-detail/SimpleCalculator.tsx`

- Substituir a lógica interna pela do componente fornecido (com `history`, `formatForDisplay`, `MAX_DISPLAY_LENGTH`, `backspace`)
- Manter o `Popover` + `PopoverTrigger` com ícone `Calculator` (integração atual)
- Dentro do `PopoverContent`, renderizar o layout do componente fornecido: header com título + botões (limpar histórico, backspace), seção de histórico, display com operação pendente, grid 4 colunas com as 5 linhas de botões
- Usar as classes do prompt: `bg-gray-700`, `bg-gray-500`, `bg-orange-500` para botões, `bg-gray-900` para fundo geral
- Usar ponto decimal (`.`) como no componente original, não vírgula

## Nenhuma alteração em

- `AgreementCalculator.tsx` (já importa `SimpleCalculator`)
- Parcelas, simulações, formalização, backend

