

## Plano — Expandir acordo em múltiplas linhas por parcela (mês selecionado)

### Caso (Ana Paula Dias da Silva)
- 2 parcelas em abril: uma **paga**, outra **a vencer**.
- Hoje aparece **1 linha** com Status da Parcela = `A Vencer` (waterfall esconde a paga).
- Ela aparece em "Pagos" porque `_hasPaidInScope = true`, mas o badge da parcela mostra só a pior — confunde.

### É viável? Sim.
A informação já existe (`getInstallmentsForMonth` + `classifyInstallment` por parcela). Hoje agregamos com waterfall; basta **não agregar** quando há mês selecionado e o acordo tem >1 parcela no mês.

### Mudança proposta — modo "split por parcela" no mês

**1. `AcordosPage.tsx`** — quando `isMonthSelected`:
- Em vez de empurrar 1 linha por acordo com `_installmentClass` agregada, empurrar **N linhas** (uma por parcela do mês), cada uma com:
  - `_installmentClass` = classificação **daquela parcela** (não mais o pior do mês)
  - `_installmentNumber`, `_installmentKey`, `_installmentDueDate`, `_installmentValue` (novos campos opcionais)
  - `_paidCount` / `_totalCount` continuam sendo do acordo inteiro (mantém visão global)
  - `_hasPaidInScope` por linha = `cls === "pago"` (afeta qual aba a linha aparece)
- Filtro por aba (`statusFilter`) passa a operar **por linha** automaticamente:
  - Aba **Pagos**: linhas com `_installmentClass === "pago"`
  - Aba **Vigentes**: linhas com `_installmentClass === "vigente"`
  - Aba **Vencidos**: linhas com `_installmentClass === "vencido"`
  - Resultado: Ana Paula aparecerá **2x em abril** — 1x em "Pagos" (parcela paga) e 1x em "Vigentes" (parcela a vencer). Status do Acordo continua igual (`completed`/`Quitado` ou `Vigente`).

**2. `AgreementsList.tsx`** — pequenos ajustes:
- `key` do `<TableRow>` passa a ser `${a.id}:${_installmentKey ?? "all"}` para evitar warning de duplicatas
- Adicionar coluna leve **"Parcela"** (ex.: `Entrada`, `1ª`, `2ª`...) **só quando** `_installmentNumber` estiver definido — ajuda a distinguir as 2 linhas do mesmo cliente
- Tooltip na coluna explicando: "No mês selecionado, cada parcela é exibida em sua própria linha"

**3. Modos sem mês selecionado** (range de datas / todos os meses): **mantém comportamento atual** (1 linha por acordo, sem `_installmentClass`). Sem regressão.

**4. Counters do header** (Vigentes/Pagos/Total) — recalcular com base em **linhas** quando em modo mês, ou manter contagem distinta de acordos. Decisão: contar **linhas** em modo mês (consistente com o que o usuário vê na tabela). Total geral continua sendo distinct count de acordos.

### Casos de borda
- Acordo com 1 parcela só no mês → 1 linha (igual hoje, comportamento idêntico).
- Acordo com 2 parcelas mesmo status (ex: ambas vencidas) → 2 linhas, ambas em "Vencidos". Pode parecer duplicado, mas é factualmente correto (são 2 parcelas vencidas distintas).
- Status globais (`cancelled`, `pending_approval`) → continuam 1 linha por acordo (não têm parcela contextual).

### Arquivos
- `src/pages/AcordosPage.tsx` — split em N linhas no `useMemo` de `classifiedAgreements` quando `isMonthSelected`.
- `src/components/acordos/AgreementsList.tsx` — key composta + nova coluna opcional "Parcela".

### Sem alteração
Schema, RLS, classifier, services. Pura lógica de apresentação.

