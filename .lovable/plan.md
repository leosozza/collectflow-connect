

# Análise: "Valor Atualizado" não exibe total ao selecionar parcelas

## Diagnóstico

Após revisão detalhada do código em `AgreementCalculator.tsx`, a lógica de cálculo está correta:
- `rowCalcs` calcula valores para todas as parcelas
- `totals` filtra `rowCalcs` pelos `selectedIds` e soma corretamente
- `totals.totalAtualizado` = `totalBruto - descontoVal`
- O badge "Valor Atualizado" (linha 562-564) renderiza `totals.totalAtualizado`

**Causa provável**: O badge "Valor Atualizado" está dentro de um container `flex-wrap` com `ml-auto`. Com todos os inputs (Data Cálculo, % Juros, % Multa, % Honor., % Desc., R$ Desc.) na mesma linha, o badge pode estar sendo empurrado para uma segunda linha que fica **cortada** pelo `overflow-hidden` adicionado ao `DialogContent`. O card Section 1 tem `flex-shrink-0`, mas o conteúdo interno pode ultrapassar a altura visível do card.

## Solução

### Arquivo: `src/components/client-detail/AgreementCalculator.tsx`

**1. Separar o badge "Valor Atualizado" dos inputs**, colocando-o em sua própria linha abaixo dos campos de cálculo, fora do `flex-wrap`:

Antes (tudo em um único `flex-wrap`):
```
[Data Cálculo] [% Juros] [% Multa] [% Honor.] [% Desc.] [R$ Desc.] [Valor Atualizado R$ X]
```

Depois (badge em linha separada, alinhado à direita):
```
[Data Cálculo] [% Juros] [% Multa] [% Honor.] [% Desc.] [R$ Desc.]
                                                    Valor Atualizado: R$ X,XX
```

O badge será movido para fora do `div flex-wrap` e colocado em um `div` separado com `flex justify-end`, garantindo visibilidade em qualquer resolução.

**2. Confirmar que a barra inferior (tfoot) reflete o total corretamente** — a estrutura atual do `tfoot` está com colunas alinhadas (11 colunas = colgroup), mas verificar se o `colSpan={3}` na célula "Totais" não está deslocando os valores. Se necessário, ajustar.

### Resultado esperado
- "Valor Atualizado" sempre visível, sem risco de corte por overflow
- Totais no rodapé da tabela alinhados com as colunas do header
- Valor atualiza dinamicamente ao marcar/desmarcar parcelas

