

## Corrigir edição de data de parcela e reemissão de boleto

### Diagnóstico

Cenário do operador Gustavo no acordo `0167cddb-…` (CPF 01768130124, Cesiane):

1. Tabela `agreements`: `custom_installment_dates = {}`. Já existe um boleto registrado para a entrada (R$ 579,80, vencimento original 2026-04-20).
2. Hoje é 2026-04-20 — **a data do boleto vigente é igual a hoje**.
3. Gustavo abre o lápis na coluna "Vencimento", escolhe uma nova data, clica **Salvar** e depois clica em **Reemitir Boleto**.

Três problemas concorrem para o erro:

**A) Reemissão usa data antiga (cache local).**
Em `AgreementInstallments.tsx`, `inst.dueDate` é derivado de `agreement.custom_installment_dates` (prop). Após salvar a data, `handleSaveDateEdit` faz `onRefresh?.()` e `invalidateQueries(["client-agreements", cpf])`, mas **o objeto `agreement` recebido como prop só é atualizado quando o pai (`ClientDetailPage`) refaz o fetch**. Se o usuário clica em "Reemitir Boleto" antes do parent re-renderizar, `inst.dueDate` ainda é a data velha (= hoje) — a Negociarie aceita, mas o boleto reemitido nasce com a mesma data antiga. O operador percebe e tenta de novo.

**B) Reemissão de entrada com vencimento = hoje gera erro no gateway.**
Negociarie rejeita `data_vencimento <= hoje` para boleto novo. Se Gustavo está justamente tentando "empurrar" a data porque o boleto venceu hoje, o primeiro Reemitir (ainda com data antiga em cache) volta com erro do gateway.

**C) Warning de `forwardRef` em `DialogFooter`.**
`src/components/ui/dialog.tsx` exporta `DialogFooter` como função simples (sem `React.forwardRef`). Quando usado dentro de Radix (que tenta encaminhar ref), gera o warning visível no console. Não trava, mas precisa ser corrigido — atrapalha diagnóstico futuro.

### Mudanças

**1. `src/components/client-detail/AgreementInstallments.tsx` — `handleSaveDateEdit`**

- Após `updateInstallmentDate`, atualizar **localmente** o objeto `agreement.custom_installment_dates` antes de fechar o diálogo, para que a próxima ação (clicar em Reemitir) já use a data nova:
  ```ts
  // Mutate prop in-place is safe since parent will refetch; ensures immediate consistency
  agreement.custom_installment_dates = { ...(agreement.custom_installment_dates || {}), [inst.customKey]: dateStr };
  ```
- Aguardar `await onRefresh?.()` (transformar a prop em assíncrona se já não for) e só então fechar o diálogo, garantindo que o parent já recarregou.
- Invalidar também `["client-detail", cpf]` (e qualquer outra chave usada por `ClientDetailPage`) — hoje só invalida `client-agreements`.

**2. `src/components/client-detail/AgreementInstallments.tsx` — `handleGenerateBoleto`**

- Validar antes de chamar a API:
  ```ts
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
  if (due < today) {
    toast({ title: "Data de vencimento inválida", description: "Edite o vencimento para uma data futura antes de reemitir o boleto.", variant: "destructive" });
    return;
  }
  ```
- Permite vencimento = hoje (Negociarie aceita), bloqueia anteriores com mensagem clara.

**3. `src/services/agreementService.ts` — `updateInstallmentDate`**

- Retornar o objeto atualizado:
  ```ts
  return updated;
  ```
  Permite o componente atualizar o cache imediatamente sem depender do refetch do parent.
- Validar formato `yyyy-MM-dd` antes do update (rejeitar string vazia/inválida com erro claro).
- Adicionar `logAction({ action: "data_parcela_alterada", entity_type: "agreement", entity_id: agreementId, details: { installment_key, new_date } })` para auditoria.

**4. `src/components/ui/dialog.tsx` — `DialogFooter`**

- Converter para `React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(...)` (mesmo padrão de `DialogHeader`). Elimina o warning e libera uso seguro dentro de Radix.

### Validação

1. Abrir o acordo `0167cddb-…`, clicar no lápis da Entrada, escolher 2026-04-25, **Salvar** → toast "Data atualizada com sucesso", linha mostra `25/04/2026` imediatamente.
2. Clicar em **Reemitir Boleto** → novo boleto criado pela Negociarie com `data_vencimento = 2026-04-25`; cobrança antiga (`2026-04-20`) marcada como `substituido`.
3. Tentar reemitir com data passada (ex: editar p/ 2026-04-15) → bloqueado com toast "Data de vencimento inválida — edite o vencimento para uma data futura antes de reemitir o boleto." Sem chamada ao gateway.
4. Console limpo: warning de `forwardRef` em `DialogFooter` desaparece.
5. `audit_logs` registra `data_parcela_alterada` com `installment_key=entrada`, `new_date=2026-04-25` para o user do Gustavo.
6. Operador sem permissão (RLS) recebe erro claro do Supabase no toast — não muda comportamento, só ganha rastreabilidade.

### Fora de escopo

- Refazer toda a sincronização de cache do `ClientDetailPage` (apenas o necessário para esta tela funcionar).
- Mudar regras de validação de data da Negociarie (mantemos a validação local apenas como guarda).

