

## Problema Identificado

Ao aprovar um acordo, o sistema **deleta** as parcelas originais da tabela `clients` e cria novas parcelas do acordo no lugar. Quando o acordo é cancelado, essas novas parcelas ficam como "quebrado" — mas as originais já foram apagadas, impossibilitando novas tentativas de acordo.

O correto é: os **títulos originais** nunca devem ser alterados/deletados pelo acordo. As parcelas do acordo devem existir apenas no contexto do acordo (já são virtuais no `AgreementInstallments`). Pagamentos do acordo devem abater o saldo devedor nos títulos originais.

## Plano de Implementação

### 1) Corrigir `approveAgreement` em `agreementService.ts`

**Remover** as etapas 2 e 3 (delete parcelas originais + insert novas parcelas). A aprovação deve apenas:
- Atualizar o status do acordo para `approved`
- Registrar audit log
- Cancelar protestos/Serasa (já existente)

As parcelas do acordo já são renderizadas virtualmente pelo `AgreementInstallments` a partir dos dados do próprio acordo — não precisam existir na tabela `clients`.

### 2) Corrigir `cancelAgreement` em `agreementService.ts`

**Remover** a etapa 3 (update parcelas na tabela `clients` para "quebrado"). O cancelamento deve apenas:
- Atualizar o status do acordo para `cancelled`
- Registrar audit log

Os títulos originais permanecem intactos em `clients` para futuras negociações.

### 3) Atualizar lógica de pagamento de acordo

Quando um pagamento é registrado em uma parcela do acordo (via `AgreementInstallments` ou fluxo de pagamento), o valor pago deve ser distribuído/abatido nos títulos originais pendentes do CPF/credor na tabela `clients`, atualizando `valor_pago` e potencialmente o `status` para "pago" quando quitado.

Criar função `registerAgreementPayment(cpf, credor, valor)` que:
- Ordena os títulos pendentes por `data_vencimento`
- Distribui o valor pago sequencialmente, atualizando `valor_pago`
- Marca como "pago" títulos completamente quitados

### 4) Atualizar texto do AlertDialog de cancelamento

Em `ClientDetailPage.tsx`, remover a menção a "parcelas marcadas como Quebra de Acordo" no dialog de confirmação, pois o cancelamento não afetará mais os títulos.

### 5) Atualizar toast de cancelamento

Alterar mensagem de "Parcelas marcadas como quebra" para "Acordo cancelado com sucesso."

### Detalhes Técnicos

- **Títulos em Aberto**: Sempre refletem o saldo real do devedor, nunca são deletados/modificados por acordos
- **Parcelas do Acordo**: São virtuais (geradas a partir dos campos `new_installments`, `first_due_date`, `new_installment_value` do registro `agreements`)
- **Pagamento**: Abate do saldo nos títulos originais, mantendo rastreabilidade
- **Cancelamento**: Apenas muda status do acordo, títulos originais permanecem para nova tentativa

