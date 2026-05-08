## Diagnóstico

**Não foi corrigido.** As correções recentes só trataram o caso da entrada (chave `:entrada`). O bug que você descreve (pagar parcela em atraso e o sistema marcar a parcela do mês corrente como paga também) tem origem no **algoritmo FIFO** em `src/components/client-detail/AgreementInstallments.tsx` (linhas 240-282).

### Como o bug acontece hoje

1. O componente monta um pool com **todos** os `manual_payments` confirmados do acordo, ordenados por data, sem olhar `installment_key`/`installment_number`.
2. Para cada parcela (em ordem 1, 2, 3…), ele consome do pool até preencher o valor da parcela.
3. Resultado: um pagamento registrado pelo operador com `installment_key = "2"` (parcela de maio) é **engolido pela parcela 1** (que ainda estava em aberto). A parcela 1 fica marcada como "pago" com a data errada, e a parcela 2 segue em aberto. Em casos onde o valor pago cobre as duas (ex.: pagamento "junto" ou parcela 1 já tinha baixa parcial), as duas aparecem pagas.
4. Em outras telas (Carteira, dashboards) o `agreementInstallmentClassifier.ts` faz o match correto por `installment_key` — por isso o problema só aparece na aba **Parcelas** do detalhe do cliente.

## Mudanças propostas

### 1. Frontend — `AgreementInstallments.tsx` (linhas 238-285)

Reescrever a etapa FIFO para **respeitar o alvo do pagamento**:

- **Passo A — match direto:** para cada `manual_payment` confirmado que tenha `installment_key` (ou `installment_number` legado), aplicar o valor exclusivamente na parcela alvo. Acumular `paidByManual` e `lastManualDate` apenas naquela parcela.
- **Passo B — pool residual (FIFO restrito):** o que sobrar (pagamento sem `installment_key` nem `installment_number`, ou excedente de uma parcela quitada) entra num pool secundário aplicado FIFO **só nas parcelas que ainda não foram totalmente quitadas** (Negociarie + manual direto).
- Manter o comentário `RIVO_FIX` explicando a nova ordem (alvo > FIFO residual) para evitar regressão.

Isso elimina o vazamento entre parcelas e garante que a data de pagamento exibida seja a da baixa real daquela parcela.

### 2. Reconciliação retroativa (one-shot, somente leitura + relatório)

Antes de qualquer UPDATE em massa, rodar uma query de auditoria que liste, por tenant/acordo, os `manual_payments` confirmados onde:
- `installment_key`/`installment_number` aponta para parcela X, **mas**
- a tela atual estaria atribuindo o valor a uma parcela Y diferente (ex.: parcela anterior em aberto na mesma data).

Saída: tabela com `agreement_id`, `manual_payment_id`, parcela alvo declarada, parcela onde o FIFO encaixou, valor, data. Você revisa antes de qualquer correção em dado.

> Nenhum dado precisa ser alterado no banco — a correção é só de exibição/cálculo no front. A query serve para confirmar quais clientes podem ter exibido o status errado historicamente.

### 3. Validação

- Reproduzir um caso conhecido (cliente com parcela vencida 30/04 paga em maio e parcela de maio em aberto): aba **Parcelas** deve mostrar parcela 30/04 como **paga** com a data correta, e parcela de maio permanecer como **vigente**/`vencida`.
- Conferir que casos de pagamento "junto" (1 baixa cobrindo várias parcelas) ainda funcionam — a parcela alvo recebe primeiro, o restante alimenta o pool residual.
- Verificar dashboards e Carteira: como já usam `agreementInstallmentClassifier.ts` (match exato), nenhum número agregado deve mudar — só a aba Parcelas.

## Itens fora deste plano

- Backfill / UPDATE em `manual_payments` (não é necessário; o problema é de leitura).
- Mudanças no `agreementInstallmentClassifier.ts` (já faz match exato).

## Arquivos tocados

- `src/components/client-detail/AgreementInstallments.tsx` (edit do bloco FIFO)
- query SQL de auditoria one-shot (sem migration)
