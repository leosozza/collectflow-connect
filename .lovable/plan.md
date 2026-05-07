## Causa do erro de publicação

O Vite build está falhando com:
```
src/components/client-detail/AgreementInstallments.tsx:128:0: ERROR: Unexpected "<<"
```

O arquivo `src/components/client-detail/AgreementInstallments.tsx` ficou com **marcadores de conflito de merge não resolvidos** (`<<<<<<< HEAD / ======= / >>>>>>>`) gravados literalmente no código, em dois trechos:

- Linhas **128-142** — bloco `totalPaidFromClients` (useMemo).
- Linhas **249-267** — cálculo de `status` e `paidAt` dentro do `installmentsWithStatus.map`.

Esses marcadores foram introduzidos no commit `d08b3eab — feat: restore payment date migration and commit contract visibility improvements`. Por isso o publish retorna `build failed with exit status 1`.

Nenhum outro arquivo no `src/` ou `supabase/` tem marcador de conflito (verificado via grep).

## Resolução proposta (manter o lado HEAD)

O lado **HEAD** é o código correto e em uso pelo restante do componente. O lado mergeado (`>>>>>>> 1b6fc600`) referencia a variável `isPaidManually` que **não existe** na função (só existe `isPaidByManual` na linha 241), então adotá-lo quebraria runtime. O bloco `totalPaidFromClients` do lado mergeado também não é referenciado em nenhum outro lugar do arquivo (grep confirma: 0 usos).

### Bloco 1 (linhas 128-142)
Remover totalmente o conflito — manter apenas a linha em branco entre o `useQuery` de `portalPayments` e a leitura de `customDates`. O `totalPaidFromClients` calculado no lado mergeado fica fora porque não tem consumidor.

### Bloco 2 (linhas 249-267)
Manter o trecho HEAD:
```ts
          : isOverdue ? "vencido" : "pendente";

    let paidAt: string | undefined;
    if (status === "pago") {
      if (inst.cobranca?.data_pagamento) {
        paidAt = inst.cobranca.data_pagamento;
      } else if (confirmedManualMatches.length > 0) {
        const mp = confirmedManualMatches[0];
        paidAt = (mp as any).payment_date || (mp as any).confirmed_at || (mp as any).reviewed_at || (mp as any).created_at;
      }
    }
    return { ...inst, status, isOverdue, pendingManual, paidAt, isCancelled: false };
```

Descartar o bloco `=======` … `>>>>>>>` que usa `isPaidManually` (variável inexistente).

## Validação

1. Rodar `npx vite build` localmente após o fix — deve completar sem erros.
2. Abrir um acordo com parcelas pagas (manual + cobrança) na tela de detalhe e conferir que `paidAt` aparece corretamente.
3. Republicar pelo botão **Update**.

## Escopo

- **1 arquivo, 2 blocos removidos**, ~25 linhas no total.
- Sem mudança de schema, RLS, RPC, edge function ou outras telas.
- Sem mexer em `fetchMyGoal` / Meta do Mês (fora do escopo conforme sua decisão anterior).
- Sem reverter commits.

## Nota: erros nos logs do edge function

Os logs de `dispatch-scheduled-campaigns` mostram avisos `module "/utf-8-validate@6.0.6/denonext/package.json" not found` e `bufferutil@4.1.0`. Esses são warnings do Deno sobre módulos opcionais do `ws` e **não afetam a publicação do frontend** nem o funcionamento da função (ela continua fazendo "boot" normal logo depois). Sugiro tratar separadamente, se quiser.
