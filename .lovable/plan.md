

## Plano — Corrigir classificação da entrada como "Vencida"

### Problema
`agreementInstallmentClassifier.classifyInstallment` filtra `manual_payments` por:
```ts
if (mp.installment_key) return mp.installment_key === installment.key;
return mp.installment_number === instNumber; // 0 para entrada
```

A entrada gerada por `buildInstallmentSchedule` recebe `key: "entrada"` e `number: 0`. Se o `manual_payment` da entrada foi salvo com `installment_key = "entrada"`, o match funciona. Mas no caso da Tássia (e provavelmente outros), o registro existe mas não está casando — resultado: entrada confirmada aparece como "Vencida".

### Causa provável
Histórico de `manual_payments` antigos onde:
- `installment_key` é `null` **e** `installment_number` é `null` (ou diferente de 0), ou
- `installment_key` foi salvo como `"0"` em vez de `"entrada"`.

### Mudança
Em `src/lib/agreementInstallmentClassifier.ts`, ampliar o matching da entrada para ser tolerante a variações legadas:

```ts
const mps = manualPayments.filter(mp => {
  if (mp.agreement_id !== agId) return false;
  if (mp.installment_key) {
    // Match direto + tolerância para entrada salva como "0"
    if (installment.isEntrada) {
      return mp.installment_key === installment.key 
          || mp.installment_key === "0"
          || (installment.key === "entrada" && mp.installment_key === "entrada");
    }
    return mp.installment_key === installment.key;
  }
  // Fallback legado: sem installment_key
  if (installment.isEntrada) {
    return mp.installment_number === 0 || mp.installment_number === null;
  }
  return mp.installment_number === instNumber;
});
```

### Validação
Antes de aplicar, vou rodar uma query no banco no caso da Tássia para confirmar **qual** é o formato real do `manual_payment` da entrada dela — assim a correção vira específica para o problema real (sem chutar). Se for outro formato, ajusto o filtro.

### Arquivos
- `src/lib/agreementInstallmentClassifier.ts` — única alteração.

### Sem alteração
Schema, RLS, UI, services. Pura correção de matching.

