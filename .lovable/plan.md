

# Fix: Renato Aparecendo em Vigentes ao Invés de Pagos

## Problemas Identificados

### 1. Mismatch no installment_key da entrada
O gerador de boletos (`generate-agreement-boletos`) usa `agreementId:0` como chave da entrada. Porém, o classificador (`agreementInstallmentClassifier.ts`) procura por `agreementId:entrada`. Resultado: a cobrança paga da entrada nunca é encontrada pelo classificador.

**Dado real do Renato:**
- Cobrança da entrada: `installment_key = "65585edf...:0"`, `status = "pago"`
- Classificador busca: `"65585edf...:entrada"` → não encontra → classifica como vigente/vencido

### 2. Lógica "pior status" para múltiplas parcelas no mesmo mês
Renato tem **duas parcelas em abril**: entrada (08/04, paga) e parcela 2 (30/04, vigente). O sistema pega o "pior status" entre todas as parcelas do mês, resultando em `vigente`. Isso é correto conceitualmente — um acordo com parcela pendente no mês não deveria ir para "Pagos". Mas o bug #1 faz a entrada nem ser reconhecida como paga.

## Correção

### Arquivo: `src/lib/agreementInstallmentClassifier.ts` (linha 120)

Alterar a construção do `installmentKey` para usar o número (0) em vez de "entrada", alinhando com o formato real no banco:

```ts
// ANTES:
const installmentKey = `${agId}:${installment.isEntrada ? "entrada" : installment.number}`;

// DEPOIS:
const installmentKey = `${agId}:${installment.number}`;
```

Isso resolve o caso do Renato: a entrada (number=0) será buscada como `agreementId:0`, que é o valor real na tabela `negociarie_cobrancas`.

### Resultado esperado
- Entrada de abril (08/04): classificada como **pago** (cobrança encontrada com status "pago")
- Parcela 2 de abril (30/04): classificada como **vigente** (ainda não venceu)
- Status final do mês: **vigente** (pior entre pago e vigente)

**Nota:** Renato continuará em "Vigentes" em abril porque tem uma parcela pendente (30/04). Ele só aparecerá em "Pagos" quando **todas** as parcelas de abril estiverem pagas. Esse é o comportamento correto conforme a lógica definida anteriormente.

### Impacto
- Apenas o classificador é alterado (1 linha)
- Nenhum impacto em outras rotas, dashboard ou edge functions

