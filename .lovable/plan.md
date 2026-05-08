## Contexto

A correção anterior em `agreementInstallmentClassifier.ts` resolveu a Carteira (status global do CPF/credor), mas a tela de detalhe do cliente (`/carteira/<cpf>`) usa **outro componente** com sua própria leitura de cobranças: `src/components/client-detail/AgreementInstallments.tsx`. Esse componente ainda procura a entrada com a chave legada `<agreementId>:0`, enquanto o gerador de boleto persiste como `<agreementId>:entrada` / `entrada_2` / `entrada_3` …

Verificação no banco confirmou:
- 7 entradas pagas via Negociarie usam o formato canônico `:entrada` / `:entrada_N`.
- **3 dessas entradas** já têm `manual_payments` confirmados pelo operador (porque o sistema mostrava "vencido"), mesmo valor e mesma data aproximada → duplicidade real (ex.: 68b7fd89… R$ 470, 6b88fbd3… R$ 577,20, 16e63dfe… R$ 135,20).
- O caso da Angela (`c8f5de8f…` R$ 482) não tem baixa manual, será corrigido só pela leitura.

## Mudanças propostas

### 1. Frontend — `src/components/client-detail/AgreementInstallments.tsx`

Trocar a montagem do `expectedKey` da entrada para usar a chave canônica e manter retrocompatibilidade:

- Linha 187: para a 1ª entrada, procurar por `${agreementId}:entrada` **e** cair no fallback legado `${agreementId}:0`. Para entradas adicionais, manter `${agreementId}:${customKey}` (já correto).
- Linha 213: para parcelas comuns manter `:1, :2…` (já correto), só reforçar fallback legado.

Resultado: a aba Parcelas do detalhe passa a marcar a entrada como **paga** sempre que existir cobrança Negociarie liquidada — para todos os clientes, sem migration.

### 2. Backend — Migration de reconciliação (one-shot)

Criar migration que:

a. Identifica `manual_payments` confirmados de entrada (`installment_key LIKE 'entrada%'` ou `installment_number = 0`) cujo `agreement_id` também tem `negociarie_cobrancas` com `installment_key = '<agId>:<mesma_chave>'` em status `pago/RECEIVED/CONFIRMED` e `valor_pago` ≈ `amount_paid` (tolerância R$ 0,01).

b. Para cada caso:
   - Marca o `manual_payments` como `status = 'superseded'` (novo valor permitido pelo enum/string check, ou usa `cancelled` se o constraint não aceitar novo valor — confirmar consultando o tipo da coluna).
   - Adiciona `metadata.superseded_by = 'negociarie_cobranca'` + `metadata.superseded_at = now()` + `metadata.original_status` para auditoria/reversão.
   - Insere registro em `audit_logs` (`action = 'manual_payment.superseded_by_negociarie'`, com `tenant_id`, `agreement_id`, valores e ids envolvidos).

c. **Não altera** registros sem cobrança Negociarie equivalente (ou seja, baixas manuais "puras" continuam ativas).

d. Idempotente: a query usa `WHERE manual_payments.status IN ('confirmed','approved')`, então re-execução não duplica efeito.

Esperado: 3 registros afetados no tenant atual; varredura cobre todos os tenants.

### 3. Validação pós-deploy

- Recarregar `/carteira/11411461770?credor=TESS+MODELS…` → entrada R$ 482 deve aparecer **paga** com data 05/05.
- Para os 3 casos com duplicidade: aba Parcelas mostra a entrada paga (fonte Negociarie) sem somar manual em outras telas.
- Conferir dashboards Total Recebido / Provisionado: valor não cai (Negociarie já era contado lá) e não dobra.

## Itens fora deste plano

- Os "erros de build" mencionados em `AgreementInstallments.tsx:275` e `CarteiraPage.tsx:973` **não aparecem em `tsc --noEmit`** — não há erro real para corrigir. Se você estava vendo um aviso/lint específico, me mande a mensagem exata que eu trato em separado.

## Arquivos tocados

- `src/components/client-detail/AgreementInstallments.tsx` (edit)
- nova migration SQL (reconciliação one-shot + audit_logs)
