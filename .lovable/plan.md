

# Plano: Calculadora Simples no Formalizar Acordo

## Objetivo

Adicionar um botão de calculadora (estilo iOS, como na referência) dentro do `AgreementCalculator`. O botão fica discreto no header do card. Ao clicar, abre um Popover com uma calculadora básica (4 operações + %). Não altera nada da lógica de parcelas, simulações ou formalização.

## Implementação

### 1. Criar componente `SimpleCalculator`

**Novo arquivo**: `src/components/client-detail/SimpleCalculator.tsx`

- Calculadora com display e teclado numérico (AC, +/-, %, ÷, ×, −, +, =, vírgula)
- Visual inspirado na referência (botões redondos, operadores em laranja)
- Lógica simples com useState: `display`, `previousValue`, `operation`, `waitingForOperand`
- Envolvida em um Popover que abre/fecha ao clicar no botão

### 2. Integrar no `AgreementCalculator.tsx`

- Importar `SimpleCalculator`
- Adicionar o botão no header do card (ao lado do título ou dos botões existentes), usando o ícone `Calculator` já importado
- O Popover abre sobre o conteúdo sem interferir no layout

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/SimpleCalculator.tsx` | **Novo** — calculadora simples |
| `src/components/client-detail/AgreementCalculator.tsx` | Adicionar botão que abre a calculadora |

Nenhuma alteração em parcelas, simulações, formalização, serviços ou backend.

