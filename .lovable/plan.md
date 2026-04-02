

# Plano: Corrigir exibição de boletos gerados nas parcelas do acordo

## Problema

Dois problemas distintos afetam a exibição de boletos:

### 1. Matching frágil entre cobrança e parcela
O código atual em `AgreementInstallments.tsx` (linhas 135-151) associa cobrancas a parcelas comparando **mês/ano** da data de vencimento:
```typescript
const cobranca = cobrancas.find((c: any) => {
  const cDate = new Date(c.data_vencimento);
  return cDate.getMonth() === dueDate.getMonth() && cDate.getFullYear() === dueDate.getFullYear();
});
```
Isso falha quando duas parcelas caem no mesmo mês, ou quando a data do boleto difere da parcela (ex: reemissão). O campo `installment_key` já é gravado corretamente na cobrança (ex: `agreementId:0` para entrada, `agreementId:1` para parcela 1) — basta usar esse campo no match.

### 2. Caso Thais: acordo sem cobrancas
O acordo `ae3f2595` tem `boleto_pendente = false` e 0 cobrancas. Isso indica que a geração falhou mas o flag não refletiu. O fluxo precisa de proteção: após `generateAgreementBoletos`, se nenhum boleto foi gerado com sucesso, manter `boleto_pendente = true`.

## Correções

### Arquivo: `src/components/client-detail/AgreementInstallments.tsx`

**Correção 1 — Matching por `installment_key`**

Substituir o matching por mês/ano por matching exato via `installment_key`:

```typescript
// Antes (frágil):
const cobranca = cobrancas.find((c: any) => {
  const cDate = new Date(c.data_vencimento);
  return cDate.getMonth() === dueDate.getMonth() && cDate.getFullYear() === dueDate.getFullYear();
});

// Depois (exato):
const expectedKey = `${agreementId}:${instNumber}`;
const cobranca = cobrancas.find((c: any) => c.installment_key === expectedKey);
```

Aplicar nos dois pontos onde o matching ocorre (entrada e parcelas regulares).

**Correção 2 — Proteção no `executeBoletosGeneration`**

Após chamar `generateAgreementBoletos`, só limpar `boleto_pendente` se `result.success > 0`:

```typescript
if (result.success > 0) {
  await supabase.from("agreements").update({ boleto_pendente: false }).eq("id", agreementId);
}
```

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/AgreementInstallments.tsx` | Matching por `installment_key` + proteção no flag `boleto_pendente` |

Nenhuma alteração em banco, serviços ou identidade visual.

