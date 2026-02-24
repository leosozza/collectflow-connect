

## Plano: Corrigir campos de entrada de valores monetarios (R$)

### Problema

O campo "Meta Mensal (R$)" em Equipes usa `<Input type="number">`, que nao aceita formatacao brasileira (ponto como separador de milhar, virgula como decimal). Ao digitar "100.000,00", o navegador interpreta incorretamente e o valor salvo fica errado (ex: 100,00 em vez de 100.000,00).

O mesmo problema existe em outros campos monetarios do sistema.

### Solucao

Criar um componente reutilizavel `CurrencyInput` que:
- Usa `type="text"` (nao `number`)
- Formata automaticamente enquanto o usuario digita (ex: "100000" → "100.000,00")
- Retorna o valor numerico real via callback `onValueChange(number)`
- Exibe prefixo "R$" visual

### Arquivos afetados

**Criar: `src/components/ui/currency-input.tsx`**
- Componente que aceita `value: number`, `onValueChange: (val: number) => void`
- Internamente usa `type="text"` com mascara de formatacao pt-BR
- Ao digitar, formata com pontos de milhar e virgula decimal
- Ao sair do campo (blur), garante formato completo

**Editar: `src/components/cadastros/EquipeList.tsx`** (linha 126)
- Trocar `<Input type="number">` por `<CurrencyInput>`
- Estado `metaMensal` passa de string para number
- Ajustar `handleSave` para usar o valor numerico direto

**Editar: `src/components/acordos/AgreementForm.tsx`** (linhas 91, 95)
- Trocar inputs de "Valor Original" e "Valor Proposto" por `CurrencyInput`

**Editar: `src/components/cadastros/CredorForm.tsx`** (linhas 371-373, 429)
- Trocar input de "entrada_minima_valor" e "valor_fixo" dos honorarios por `CurrencyInput`

**Editar: `src/components/portal/PortalCheckout.tsx`** (linha 303)
- Trocar input de valor por `CurrencyInput`

**Editar: `src/components/gamificacao/GoalsManagementTab.tsx`** e `CampaignForm.tsx`
- Verificar e corrigir campos de meta/premio que usem `type="number"` para valores em R$

**Nota:** Campos que representam percentuais (%) ou quantidades inteiras (parcelas, dias) continuam com `type="number"` -- apenas campos monetarios (R$) serao migrados.

### Detalhes tecnicos

Logica do `CurrencyInput`:
```text
Entrada do usuario: "100000"
Formatacao visual:  "100.000,00"
Valor retornado:    100000.00

Entrada do usuario: "1500,5"
Formatacao visual:  "1.500,50"
Valor retornado:    1500.50
```

- No `onChange`: remove tudo exceto digitos e virgula, reformata com pontos de milhar
- No `onBlur`: garante 2 casas decimais
- Converte internamente: substitui pontos por nada, virgula por ponto, `parseFloat`

