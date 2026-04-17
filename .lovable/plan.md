

## Diagnóstico — Boleto sendo gerado mesmo quando forma de pagamento é Cartão/PIX

### Comportamento atual
A calculadora de acordo (`AgreementCalculator.tsx`) deixa o operador escolher forma de pagamento por **entrada** (`entrada_method`, `entrada_2_method`, …) e uma forma única para as **parcelas** (`formaPagto`). Os métodos por entrada são salvos em `custom_installment_values` (`entrada_method: "CARTAO"|"PIX"|"BOLETO"`).

Porém, ao formalizar, `handleSubmit` chama `generate-agreement-boletos` para o acordo inteiro, e essa Edge Function **ignora qualquer método** — sempre chama `POST /cobranca/nova` (boleto) na Negociarie para todas as entradas + todas as parcelas.

Resultado: operador marca "Cartão" → sistema gera boleto mesmo assim. Custo desnecessário com a Negociarie e confusão para o cliente.

### Bug secundário descoberto
A `formaPagto` (forma de pagamento das parcelas) é **lida** de `custom_installment_values["1_method"]` na hora de editar (linha 198), mas **nunca é gravada** no `handleSubmit`. Só os `entrada_method` viram persistência. Isso significa que ao reabrir um acordo, o select sempre volta a "BOLETO". Vamos corrigir junto.

### Correções

**1. `AgreementCalculator.tsx` — persistir método das parcelas**
Em `handleSubmit`, após popular `customValues` com as entradas, gravar `customValues[`${i}_method`] = formaPagto` para cada parcela `i` em `1..numParcelas` (ou pelo menos `1_method` como referência da forma única). Mantém retrocompat com a leitura existente.

**2. `generate-agreement-boletos/index.ts` — pular installments que NÃO são boleto**
No loop de `installments` (linha 244), antes do `negociarieRequest`:
- Resolver o método daquela parcela:
  - Entradas: `customValues[`${inst.key}_method`]` (ex: `entrada_method`, `entrada_2_method`)
  - Parcelas numéricas: `customValues[`${inst.key}_method`]` (com fallback para `customValues["1_method"]` ou `"BOLETO"`)
- Se o método **não for** `BOLETO` (ou seja, `CARTAO` / `PIX`), **pular** essa parcela (`continue`) e logar `Skipping installment ${inst.key} — payment method = ${method}`.
- Não contar como `failed`; ela simplesmente não vira boleto. Cartão/PIX serão tratados em fluxo próprio (link do portal já existente).

**3. Mensagem ao operador (toast)**
No `handleSubmit` do front, ajustar feedback: se `boletoResult.total` cobre só parte das parcelas (porque outras eram cartão/PIX), mostrar mensagem amigável tipo *"X boletos gerados; demais parcelas (Cartão/PIX) serão cobradas via link de pagamento"*. Implementação simples: a Edge Function já retorna `total/success/failed`; basta acrescentar um `skipped_non_boleto` ao response.

### Sem alterações em
- Schema do banco (tudo vive em `custom_installment_values` JSON, já existente).
- RLS / RPCs.
- Fluxo de cartão/PIX via portal-checkout (continua funcionando independentemente).
- `agreementService.updateAgreement` (já preserva `_method` por iterar todos os keys).

### Resultado esperado
- Operador escolhe "Cartão" para entrada ou parcelas → **nenhum boleto** é gerado para essas parcelas na Negociarie.
- Boletos só são emitidos para parcelas explicitamente marcadas como `BOLETO`.
- Toast informa quantas viraram boleto e quantas ficaram para cobrança em cartão/PIX.
- Reabrir acordo mantém a forma de pagamento das parcelas selecionada (bug secundário resolvido).

