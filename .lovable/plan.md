## Finalização: AlertDialog de cancelamento + revisão de conflitos

### Estado atual
A implementação anterior deixou o feature **quase pronto**:
- ✅ Migration `cancelled_installments jsonb` aplicada
- ✅ RPC `get_dashboard_vencimentos` já filtra parcelas canceladas
- ✅ Service `cancelInstallment` / `reactivateInstallment` funcionando
- ✅ UI: ícone Trash2 (cancelar) e RotateCcw (reativar) renderizando
- ✅ Linha com `line-through` + badge "Cancelada"
- ❌ **Falta**: o `<AlertDialog>` de confirmação que `setCancelInstallmentDialog` deveria abrir nunca foi renderizado no JSX. Hoje, ao clicar em Trash2, o estado é setado mas **nada acontece visualmente**.

### Etapa 1 — Adicionar o AlertDialog de confirmação
Em `src/components/client-detail/AgreementInstallments.tsx`, antes de `</>` final (depois do Dialog de Boleto Pendente), inserir:

```tsx
<AlertDialog
  open={!!cancelInstallmentDialog}
  onOpenChange={(o) => !o && setCancelInstallmentDialog(null)}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Cancelar parcela?</AlertDialogTitle>
      <AlertDialogDescription>
        A parcela <b>{label}</b> ({formatCurrency(value)}) será marcada como
        cancelada. Ela continuará visível na lista, mas com risco, e será
        desconsiderada das métricas de progresso e do dashboard "Parcelas
        Programadas". Você pode reativá-la depois.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Voltar</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmCancelInstallment}>
        Cancelar Parcela
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Etapa 2 — Revisão de conflitos (auditoria cruzada)

Após inspecionar todos os pontos que consomem `custom_installment_values`, identifiquei **3 áreas que precisam respeitar `cancelled_installments`** para evitar drift de números:

**2.1 — `src/lib/agreementInstallmentClassifier.ts`**
Classifica cada parcela como "em dia / vencida / paga" e alimenta o status global do acordo (em dia / atrasado / quebrado). Hoje **não conhece `cancelled_installments`**, então uma parcela cancelada vencida ainda contaria como atraso → poderia marcar acordo como "QUEBRA DE ACORDO" indevidamente.
**Fix**: pular parcelas presentes em `cancelled_installments` ao classificar.

**2.2 — `src/lib/installmentUtils.ts` (`buildInstallmentSchedule`)**
Função utilitária consumida por `documentDataResolver` (geração de contratos/recibos) e pela sync de pagamentos manuais. Hoje retorna **todas** as parcelas, inclusive canceladas.
**Fix**: aceitar opção `{ excludeCancelled: boolean }` (default false para preservar compatibilidade) e propagar `cancelled: boolean` no schedule. Documentos passam `excludeCancelled: true`; sync de pagamento manual mantém comportamento atual (só faz match por chave).

**2.3 — `total_amount` recalculado**
Hoje `cancelInstallment` apenas marca a chave como cancelada, mas **não recalcula `proposed_total`** do acordo. Isso é proposital (mantém histórico do acordo original), mas é importante deixar **explícito**: a UI de progresso, o dashboard e os documentos vão usar a soma das parcelas ativas dinamicamente — `proposed_total` continua refletindo o acordo original assinado.
**Decisão**: **não** alterar `proposed_total`. Adicionar comentário no service explicando.

### Etapa 3 — Validação adicional na UI
Reforçar `canCancel` no JSX para também bloquear quando:
- `inst.cobranca?.status === "pago"` (já coberto via `isPaid`)
- existe `manualPayment` confirmado (já coberto via `isPaid`)
- é a única entrada de uma única parcela do acordo (não faz sentido cancelar tudo — usar "Cancelar Acordo")

A regra `!isOnlyEntrada` já existe. Adicionar também: bloquear se sobrar apenas 1 parcela ativa (evitar acordo vazio):

```ts
const activeCount = installments.filter(i => !cancelledMap[i.customKey]).length;
const canCancel = ... && activeCount > 1;
```

### Resumo de arquivos a editar
- `src/components/client-detail/AgreementInstallments.tsx` → adicionar AlertDialog + reforçar `canCancel`
- `src/lib/agreementInstallmentClassifier.ts` → ignorar parcelas canceladas
- `src/lib/installmentUtils.ts` → opção `excludeCancelled`
- `src/services/documentDataResolver.ts` → passar `excludeCancelled: true`
- `src/services/agreementService.ts` → comentário explicativo sobre `proposed_total`

### Não faremos (intencional)
- Não recalcular `proposed_total` — preserva histórico contratual
- Não alterar a fonte de pagamentos reais (`agreement-real-payments`) — ela é independente das parcelas agendadas
- Não mexer em `negociarie_cobrancas` — boletos canceláveis pela UI já existente

Posso prosseguir?