

# Reorganizar layout do modal "Formalizar Acordo"

## Layout atual
1. Card **Cálculo** (parâmetros: data, juros, multa, honorários, desconto, valor atualizado)
2. Card **Parcelas** (tabela de títulos com checkboxes)
3. Grid 2 colunas: **Condições do Acordo** (esquerda) + **Simulação** (direita)

## Novo layout solicitado
1. Grid 2 colunas: **Condições do Acordo** (esquerda) + **Simulação** (direita)
2. Card **Cálculo** (parâmetros)
3. Card **Parcelas** (tabela de títulos)

## Alteração

### Arquivo: `src/components/client-detail/AgreementCalculator.tsx`

Reordenar os 3 blocos JSX dentro do `return` (linhas ~544-final):

- Mover a **Section 3** (grid com Condições + Simulação, linhas 755-end) para **antes** da Section 1
- Manter a **Section 1** (Cálculo, linhas 554-626) no meio
- Manter a **Section 2** (Parcelas, linhas 628-753) no final

Nenhuma lógica ou estilo interno muda — apenas a ordem dos blocos no JSX.

