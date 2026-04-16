

# Corrigir cálculo do VALOR ATUALIZADO no Formalizar Acordo

## Problema identificado

No `AgreementCalculator.tsx` (linha 217-220), o cálculo faz:

```
valorBruto = valor_parcela || valor_saldo  → 200
valorPago  = valor_pago                    → 200
valorOriginal = valorBruto - valorPago     → 0  ← base zerada!
```

O campo `valor_saldo` no banco (que é 200 e representa o saldo real da dívida) é ignorado porque `valor_parcela` já tem valor e o `||` nunca chega em `valor_saldo`. Depois, `valor_pago` (que coincide com `valor_parcela`) zera tudo.

## Causa raiz

A importação de dados preenche `valor_pago` = `valor_parcela` em muitos casos (títulos vencidos sem pagamento real), mas mantém `valor_saldo` com o valor correto do débito. O cálculo deveria usar `valor_saldo` como saldo efetivo quando disponível.

## Correção

### Arquivo: `src/components/client-detail/AgreementCalculator.tsx`

**Linha 217-220** — Alterar a lógica de `valorOriginal`:

```typescript
// ANTES:
const valorBruto = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
const valorPago = Number(c.valor_pago) || 0;
const valorOriginal = Math.max(0, valorBruto - valorPago);
const valorBase = valorOriginal;

// DEPOIS:
const valorBruto = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
const valorPago = Number(c.valor_pago) || 0;
const saldoExplicito = Number(c.valor_saldo) || 0;
// Priorizar valor_saldo quando existir; senão, calcular bruto - pago
const valorOriginal = saldoExplicito > 0 ? saldoExplicito : Math.max(0, valorBruto - valorPago);
const valorBase = valorOriginal;
```

**Mesma lógica nas linhas 112-114** (cálculo de honorários automáticos) — aplicar a mesma priorização de `valor_saldo`.

**Linha 699** (exibição na tabela) — o V. Bruto já está correto, a coluna "Saldo" agora refletirá o `valorOriginal` correto.

## Impacto

- Títulos com `valor_saldo` preenchido: cálculo usa o saldo real como base para juros, multa e honorários
- Títulos sem `valor_saldo`: comportamento inalterado (usa `bruto - pago`)
- VALOR ATUALIZADO passará a somar corretamente os valores com juros/multa/honorários

