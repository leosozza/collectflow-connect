## Diagnóstico

Sua intuição está correta: o problema é específico de **entradas**, não de parcelas comuns.

### Caso da Angela (CPF 11411461770)

- Acordo `c8f5de8f-55ab-4c71-b36e-714bb1dbe061` (TESS MODELS), status `pending`, entrada R$ 482,00 com vencimento 07/05/2026.
- Na tabela `negociarie_cobrancas` a entrada está **paga**:
  - `status: LIQUIDACAO`, `valor_pago: 482`, `data_pagamento: 2026-05-05`
  - `installment_key: "c8f5de8f-55ab-4c71-b36e-714bb1dbe061:entrada"`
- Não existe `manual_payments` para esse acordo — então a baixa veio só pelo Negociarie.
- Mesmo assim a UI mostra a entrada como **vencida**.

### Causa raiz

Em `src/lib/agreementInstallmentClassifier.ts`, dentro de `classifyInstallment`, a busca por cobrança Negociarie monta a chave usando `installment.number`:

```ts
const installmentKey = `${agId}:${installment.number}`;
const cob = cobrancas.find(c => c.installment_key === installmentKey);
```

Para entradas, `installment.number === 0`, então procura `…:0`. Mas a Negociarie grava a entrada como `…:entrada` (e entradas adicionais como `…:entrada_2`, etc.). Resultado: nunca encontra match para entradas pagas via boleto/PIX Negociarie e a UI cai no fallback de data → "vencido".

Parcelas comuns funcionam porque `installment.number` (1, 2, 3…) bate com o sufixo numérico do `installment_key` da Negociarie.

Observação: a `VirtualInstallment` já carrega `key` no formato canônico (`"entrada"`, `"entrada_2"`, `"1"`, `"2"`…) — basta usar `installment.key` em vez de `installment.number` aqui, igual ao que já é feito no match de `manual_payments`.

## Mudança proposta

Arquivo único: `src/lib/agreementInstallmentClassifier.ts`

Trocar a montagem da chave de cobrança Negociarie para usar `installment.key`:

```ts
const installmentKey = `${agId}:${installment.key}`;
```

Isso passa a casar:
- `entrada`, `entrada_2`, `entrada_3` → entradas múltiplas pagas via Negociarie
- `1`, `2`, `3`… → parcelas (comportamento atual preservado, pois `key` numérica == `number`)

Nenhuma outra alteração de lógica, RPC, SQL ou UI. Sem mudança de regras de status, sem migração.

## Verificação após o fix

1. Abrir Carteira → Angela → aba Acordo: a entrada de R$ 482,00 deve aparecer como **paga** (linha verde, sem "vencido").
2. Conferir que parcelas comuns continuam classificando igual (caso de outro acordo com parcelas baixadas).
3. Conferir contagem `paid/total` em `countPaidInstallments` para o acordo (entrada paga deve contar).

## Fora de escopo

Os erros de build atuais (`AgreementInstallments.tsx` linha 275 e `CarteiraPage.tsx` linha 973) são de edições anteriores não relacionadas a entradas. Posso corrigi-los junto na implementação se você quiser, mas não fazem parte deste diagnóstico — me avise se devo incluir.
