
# Corrigir desconto faltando 1 centavo

## Diagnóstico
O erro está em `src/components/client-detail/AgreementCalculator.tsx`.

Hoje o fluxo faz isso:
- o usuário digita um valor em `R$ Desc.` (ex.: `11,00`)
- o componente converte esse valor para `% Desc.` e já arredonda o percentual para 2 casas
- depois o total é recalculado a partir desse percentual arredondado

No caso do print:
```text
Total bruto:      R$ 998,66
R$ digitado:      R$ 11,00
% salvo na UI:    1,10%
Recalculo:        998,66 × 1,10% = R$ 10,99
```

Por isso o campo mostra `11`, mas a linha de desconto e o valor atualizado usam `10,99`.

## Correção proposta

### 1. Definir a origem real do desconto
Adicionar um estado para saber qual campo foi editado por último:
- `"percent"` quando o usuário altera `% Desc.`
- `"amount"` quando o usuário altera `R$ Desc.`

### 2. Centralizar o cálculo do desconto
Criar um cálculo único para:
- `descontoVal`
- `totalAtualizado`
- `remainingAfterEntrada`
- `installmentValue`
- `proposed_total`

Esse cálculo deve usar:
- o percentual quando a origem for `%`
- o valor em reais quando a origem for `R$`

Assim, se o usuário digitar `R$ 11,00`, o desconto final usado pelo sistema será exatamente `R$ 11,00`.

### 3. Manter os dois campos sincronizados só para exibição
Os campos continuam se atualizando entre si visualmente, mas:
- o campo editado define o valor real do cálculo
- o outro campo vira apenas reflexo calculado

Exemplo:
- editou `% Desc.` → `R$ Desc.` é derivado
- editou `R$ Desc.` → `% Desc.` é derivado

### 4. Padronizar arredondamento em helper
Usar um helper único, por exemplo:
- `roundMoney(value)` para 2 casas

Aplicar esse helper em todos os pontos financeiros do componente para evitar novas divergências de 1 centavo.

### 5. Garantir consistência ao gravar
Na gravação do acordo:
- `proposed_total` deve sair do desconto efetivo final
- `new_installment_value` deve sair do mesmo total final
- `discount_percent` deve refletir o desconto efetivo, sem afetar o valor em reais digitado

## Arquivo a alterar
- `src/components/client-detail/AgreementCalculator.tsx`

## Resultado esperado
- digitando `R$ 11,00`, a linha “Desconto” mostrará `R$ 11,00`
- o “Valor Atualizado” ficará exatamente `R$ 987,66`
- a simulação e a gravação do acordo usarão esse mesmo valor final
- não haverá mais divergência de 1 centavo entre campo, resumo e cálculo final

## Validação
Após implementar, validar:
1. o caso do print (`R$ Desc. = 11`)
2. edição por `% Desc.`
3. troca de títulos selecionados
4. simulação das parcelas
5. gravação do acordo e valor salvo

## Detalhe técnico
Sem migration. É uma correção de lógica frontend.
