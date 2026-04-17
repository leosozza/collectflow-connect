

## Diagnóstico — Aba "Pagos" não mostra acordos com baixas confirmadas

### Como reproduzir
Operador (perfil ≠ admin) entra em `/acordos`, troca para aba "Pagos". Vê lista vazia ou muito menor que o esperado, mesmo havendo dezenas de `manual_payments` confirmadas pelo admin (confirmei no banco: 20+ acordos do operador `68e1d831…` com `manual_payments.status='confirmed'` mas `agreements.status` ainda `pending`/`overdue`).

### Causa raiz

A lógica de filtragem da aba "Pagos" em `AcordosPage.tsx` (linhas 246–248) tem **dois caminhos divergentes**:

```ts
case "approved":
  if (isMonthSelected && cls !== undefined) return cls === "pago";  // por parcela
  return a.status === "approved";                                    // por acordo inteiro
```

**Problema 1 — Modo "Todos os Meses" / filtro por intervalo de datas**
Quando o usuário escolhe "Todos os Meses" (ou aplica `dateFrom`/`dateTo`), `isMonthSelected = false` e o filtro cai no `a.status === "approved"`. Esse status só é setado quando o **acordo inteiro** está quitado (todas as parcelas pagas). Acordos de 12 parcelas com 1–11 baixas confirmadas continuam `pending`/`overdue` — **nunca aparecem em "Pagos"**.

**Problema 2 — Modo mês selecionado**
A classificação por mês usa "pior status entre as parcelas do mês" (linhas 198–203): `pending_confirmation > vencido > vigente > pago`. Ou seja, basta UMA parcela do mês estar vencida/vigente para o acordo cair em "Vencidos"/"Vigentes" — mesmo que outras parcelas do mesmo mês estejam pagas. Resultado: "Pagos" só lista acordos onde **todas** as parcelas do mês estão pagas.

**Problema 3 — Card de stats "Pagos" usa a mesma regra estreita**
`stats.paid` (linha 274/280) também conta só `cls === "pago"` (todas parcelas do mês) ou `a.status === "approved"` (todas parcelas do acordo). Operador olha o número e acha que "nada foi pago", mas há dezenas de parcelas pagas.

**Problema 4 — Lista mostra só status do acordo, não das parcelas**
`AgreementsList` exibe apenas `Badge` do `agreement.status`, sem mostrar quantas parcelas estão pagas. O operador perde visibilidade de "X de Y parcelas baixadas".

### Correção (sem migration, só frontend)

**1. Redefinir o que significa "Pagos" na aba** — passar a incluir acordos com **pelo menos uma parcela paga** no contexto selecionado:

- **Modo mês selecionado:** acordo entra em "Pagos" se **alguma** parcela do mês tem `cls === "pago"` (em vez de exigir todas). Mantém também aparecer em "Vencidos"/"Vigentes" se houver outras parcelas — operador vê o acordo nas duas abas pelas duas óticas. Alternativa: criar atributo composto `_hasPaidInstallment` separado de `_installmentClass`.
- **Modo "Todos os Meses" / range de datas:** acordo entra em "Pagos" se houver **qualquer** parcela paga (manual_payment confirmed OU cobrança Negociarie paga) no escopo, OU se `a.status === 'approved'`. Implementação: pré-computar um Set `agreementsWithPaidInstallments` no useMemo das classificações, varrendo todas as parcelas do schedule.

**2. Ajustar `stats.paid`** para refletir a mesma lógica nova (acordos com ≥1 parcela paga).

**3. Enriquecer `AgreementsList`** com coluna "Parcelas pagas" (`X / Y`) calculada a partir de `cobrancas + manualPayments` confirmados. Dá visibilidade imediata sem precisar abrir o cliente.

**4. (Opcional, mas recomendado) Subdividir "Pagos" em duas leituras**:
   - "Quitados" (acordo inteiro = `a.status === 'approved'`)
   - "Com baixas" (≥1 parcela paga, mas acordo não quitado)
   Renderizar como sub-tabs ou badge auxiliar. Decisão: começar simples — uma só aba "Pagos" com a regra inclusiva + coluna "Parcelas pagas" mostrando o detalhe.

**5. Bug colateral (`AgreementsList` ref warning no console)** — `Badge` recebe `ref` implícito da `TableCell`. Envolver em `<span>` ou usar `forwardRef`. Correção trivial junto.

### Arquivos a modificar
- `src/pages/AcordosPage.tsx` — useMemo de `classifiedAgreements` (anotar `_paidInstallmentsCount`/`_totalInstallmentsCount`), `filteredAgreements` (regra "Pagos" inclusiva), `stats`.
- `src/components/acordos/AgreementsList.tsx` — nova coluna "Parcelas Pagas" + fix do ref warning.
- `src/lib/agreementInstallmentClassifier.ts` — nova helper `countPaidInstallments(agreement, cobrancas, manualPayments)` que retorna `{ paid, total }`.

### Sem alterações em
- Schema, RLS, `manual_payments`, `agreementService`. Toda a correção é de leitura/UI.

### Resultado esperado
- Operador acessa "Pagos" com qualquer filtro (mês, ano, range, "todos") e vê todos os acordos com baixas confirmadas pelo admin.
- Coluna "Parcelas Pagas" mostra "3 / 12" — clareza imediata de quanto já foi quitado.
- Card "Pagos" reflete acordos com ao menos uma parcela paga (não só os 100% quitados).
- Acordos 100% quitados continuam aparecendo (não há regressão).

