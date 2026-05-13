---
name: Negociarie cobrança lookup per installment
description: Anti-leak rules for matching negociarie_cobrancas to installments — prevents one paid cobrança being claimed by multiple parcels
type: logic
---
Acordos com entrada gerados antes da padronização canônica gravavam `negociarie_cobrancas.installment_key` com offset da entrada (parcela 1 → `:2`). O gerador atual usa chave canônica (parcela 1 → `:1`, entrada → `:entrada`).

**Bug histórico**: Sem proteção, parcela 2 (canônica `:2`) reivindicava a cobrança legada `:2` que pertencia à parcela 1 — herdando "pago" indevidamente.

**Regras**:
1. Lookup em `AgreementInstallments.tsx` e `agreementInstallmentClassifier.ts` deve manter `Set<string> usedCobrancaIds` por acordo, evitando reuso.
2. Ao escolher cobrança, prioridade: (a) chave canônica + `data_vencimento` igual à `dueDate`, (b) chave canônica não-usada, (c) chave legada não-usada.
3. Backfill: `negociarie_cobrancas` antigas foram realinhadas via match por `data_vencimento` contra a programação do acordo (migration de maio/2026).
4. Callers de `classifyInstallment` que iteram um schedule devem passar o `usedCobrancaIds` compartilhado entre as parcelas do mesmo acordo.
