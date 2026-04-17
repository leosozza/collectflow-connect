

## Análise da aba /acordos — Inconsistências encontradas

### 🔴 Bug 1 (crítico): Aba "Pagos" duplicada / inconsistente quando mês selecionado
Em `AcordosPage.tsx` (linhas 274-279), a aba "Pagos" usa lógica **inclusiva**:
```ts
case "approved":
  return hasPaid === true || a.status === "approved";
```
Mas no modo **mês selecionado**, cada parcela vira uma linha. Resultado:
- Cliente com 2 parcelas em abril (1 paga, 1 a vencer) — a linha "a vencer" também tem `_hasPaidInScope = false`, porém o acordo tem outra linha paga.
- **Mas** o filtro `_hasPaidInScope` é por linha (`cls === "pago"`), então só a linha paga aparece em "Pagos". OK aqui.
- **Problema real**: acordo com `status === "approved"` (Quitado) faz **TODAS** as linhas dele aparecerem em "Pagos", inclusive parcelas com `_installmentClass === "vigente"` ou `"vencido"` daquele mês. Isso é inconsistente com a UX que você definiu ("uma linha por parcela com status real da parcela").

**Correção**: no modo mês, filtrar somente `cls === "pago"` em "Pagos", ignorando `a.status === "approved"`.

### 🔴 Bug 2: Aba "Vigentes" / "Vencidos" idem
Linhas 271-273 e 280-282: quando `cls === undefined` (acordo de status global como `cancelled` colado no resultado, ou modo "todos"), cai no fallback `a.status === "pending"` / `"overdue"`. Isso pode misturar lógica em telas mistas, mas no fluxo atual está OK.

### 🟡 Bug 3: Counter "Pagos" do header conta duplicado
Linha 309: `stats.paid` conta **linhas** com `_hasPaidInScope`. No modo mês, se um acordo tem 2 parcelas pagas em abril, conta como **2 pagos** — mas o card diz "Total de Acordos: X" contando linhas também (linha 301). Internamente consistente, mas o label "Total de Acordos" está enganoso (são linhas/parcelas, não acordos distintos).

**Correção sugerida**: renomear cards no modo mês para "Total de Parcelas / A Vencer / Pagas", ou contar `distinct agreement.id`.

### 🟡 Bug 4: Warning React no console
```
Function components cannot be given refs. Check the render method of AgreementsList.
at Badge → span → td
```
Em `AgreementsList.tsx` linhas 105-122, os `<Badge>` estão dentro de `<span>` puro com `title`. Provavelmente um componente Tooltip antigo passa `ref` ao `Badge`, que não usa `forwardRef`. Não quebra nada, mas polui o console.

**Correção**: o `Badge` já aceita className diretamente — remover o wrapper `<span>` desnecessário, ou aplicar o `title` diretamente no `Badge` (que renderiza `<div>`).

### 🟡 Bug 5: Variável morta em `AgreementsList.tsx`
Linhas 78-80: `paid`, `total`, `showCount` ainda são extraídos mas **nunca usados** (a coluna foi removida). Limpar.

### 🟡 Bug 6: Export Excel não reflete o split por parcela
Linhas 422-436: o export ignora `_installmentNumber`, `_installmentClass`. Quem exporta o mês de abril da Ana Paula pega só os dados do acordo, não das 2 parcelas separadamente. Pode confundir quem usa o relatório.

**Correção**: incluir colunas "Parcela" e "Status da Parcela" quando aplicável.

### 🟢 Observações OK
- Status `completed` agora mapeado para "Quitado" ✓
- Coluna "Parcelas Pagas" removida ✓
- Key composta `${a.id}:${instKey}` evita warning de duplicatas ✓
- Lógica de fallback `entrada` vs `installment_key` no classifier está correta ✓

---

## Plano de correção sugerido

Priorizando bugs reais, sem inventar features:

1. **Bug 1 (alto)** — em `AcordosPage.tsx` filtro `case "approved"`: no modo mês usar **somente** `cls === "pago"`. Idem para `vigentes` e `overdue` que já fazem isso. Garante coerência entre o badge da linha e a aba.
2. **Bug 4 (médio)** — em `AgreementsList.tsx`: remover `<span>` wrapper dos badges, aplicar `title` direto no Badge. Elimina warning React.
3. **Bug 5 (baixo)** — remover variáveis mortas `paid`, `total`, `showCount`.
4. **Bug 3 (decisão)** — preciso confirmar com você: no modo mês, os cards do topo devem contar **acordos distintos** ou **parcelas (linhas)**? Hoje contam linhas e o label diz "Acordos".
5. **Bug 6 (decisão)** — incluir colunas de parcela no Excel quando em modo mês?

### Pergunta de validação
Antes de implementar 3 e 6, qual sua preferência? Posso seguir só com 1, 4 e 5 (correções puras) e deixar 3/6 para depois.

### Arquivos
- `src/pages/AcordosPage.tsx`
- `src/components/acordos/AgreementsList.tsx`

### Sem alteração
Schema, RLS, classifier, services.

