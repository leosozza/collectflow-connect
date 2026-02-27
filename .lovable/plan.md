

## Problema identificado

Os 3 modelos pré-sugeridos ("À Vista", "Entrada + Parcelas", "Cartão") só aparecem quando o nome do credor nos títulos do cliente bate exatamente com um credor cadastrado na tabela `credores`. 

No caso atual: os acordos usam credor `"YBRASIL"`, mas o único credor cadastrado é `"TESS MODELS... / Maxfama"`. Sem match, `credorRules` fica `null` e o bloco dos modelos não renderiza.

## Correção

**Arquivo: `src/components/client-detail/AgreementCalculator.tsx`**

1. **Sempre exibir os modelos de acordo** — remover a condição `{credorRules && (...)}` (linha 330) que esconde os botões
2. **Usar valores padrão quando `credorRules` é null**:
   - "À Vista": desconto padrão de 10% quando não há regras
   - "Entrada + Parcelas": desconto padrão de 10%, entrada 30%, 5 parcelas
   - "Cartão": desabilitar botão quando não há regras (precisa de juros/multa para calcular)
3. Ajustar `getAgingDiscount()` para retornar um desconto padrão (ex: 10%) quando `credorRules` é null

### Verificação da página /acordos

A página `/acordos` já está correta:
- Sem botão "Nova Proposta"
- 3 cards com apenas quantidades (Total, Pendentes, Pagos)
- Filtro por credor funcional
- Busca por nome/CPF funcional
- Admin vê tabs com "Aguardando Liberação"

