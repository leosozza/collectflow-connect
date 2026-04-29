## Problema

A operadora **Sabrina** (role `operador`, tenant Maxfama) entra em **Financeiro → Acordos** e vê **"Nenhum acordo encontrado"**, mesmo tendo **13 acordos criados** (11 ativos) no banco.

## Diagnóstico

Confirmei via banco:
- Sabrina: `user_id=7766f9ab…`, `tenant_id=39a450f8…`, role `operador`.
- 13 acordos com `created_by = user_id dela` (Adriana, Núbia, Mariana, Líbia, Letícia, Vanessa, Samara, Valdenia, Josiane, etc.).
- RLS de `agreements` permite `tenant_id = get_my_tenant_id()` ✓.

A consulta do servidor está correta. O problema está no **filtro client-side da página `AcordosPage`**:

1. O default é `selectedMonth = mês atual` + aba `vigentes`.
2. Em modo mês, a aba "Vigentes" só mostra acordos cuja **parcela do mês selecionado** é classificada como `vigente` (não vencida, não paga).
3. Vários acordos da Sabrina têm `first_due_date` em datas como 15/04, 17/04, 18/04 — hoje (29/04) já estão **vencidos** → caem na aba "Vencidos", não "Vigentes".
4. Outros têm `first_due_date` em 30/04 ou maio — caem em "vigentes" só se a busca incluir maio.
5. Acordos com status global `pending` (a maioria dos dela) **só aparecem na aba "Vigentes" quando `selectedMonth = "todos"`**; em modo mês, vira critério por parcela.
6. Resultado: ela vê 0 acordos nas abas, especialmente se nenhuma parcela cair exatamente no mês corrente como "vigente".

Há também um problema de **descoberta**: ela não tem indicação visual de quantos acordos existem em outras abas/meses, então conclui que "não tem nada".

## Solução

### 1. Mostrar contadores por aba (status filter)

Calcular e exibir o número de acordos em cada aba (Pagos / Vigentes / Vencidos / Aguardando Liberação / Cancelados / Confirmação) usando o conjunto já filtrado por credor + operador + busca + período. Assim Sabrina vê imediatamente "Vencidos (5)" ou "Vigentes (3)" e não fica perdida.

### 2. Botão "Ver todos os meses" quando lista vier vazia

Quando `filteredAgreements.length === 0` mas `agreements.length > 0`, exibir uma mensagem amigável:
> "Você tem N acordos, mas nenhum corresponde aos filtros atuais."
> [Botão: "Ver todos os meses"] que faz `setSelectedMonth("todos")`.

### 3. Aba "Vigentes" inclusiva no modo mês

Hoje, em modo mês, "Vigentes" só mostra parcelas com `cls === "vigente"`. Ajuste:
- Continuar mostrando parcelas vigentes do mês.
- **Adicionalmente**, mostrar acordos com status global `pending` cuja **primeira parcela ainda não venceu** (ou que não têm nenhuma parcela vencida ainda) — para que acordos recém-criados apareçam mesmo sem parcela exatamente no mês.

Alternativa mais simples e segura: alterar o default de `selectedMonth` para `"todos"` (inicial), e a partir daí ela navega por meses se quiser. Isso evita confusão para todos os operadores.

### 4. Indicação visual do escopo

Acima da lista, mostrar uma linha:
> "Mostrando seus acordos" (não-admin) ou "Mostrando todos os acordos do tenant" (admin).

Assim a Sabrina entende que está vendo só os dela e o admin entende que vê tudo.

## Arquivos afetados

- `src/pages/AcordosPage.tsx` — adicionar contadores nas abas, mensagem de vazio com CTA, alterar default de `selectedMonth` para `"todos"`, badge de escopo.
- `src/components/acordos/AgreementsList.tsx` — opcionalmente, melhorar o estado vazio com instrução.

## Detalhe técnico

```ts
// Contadores por aba
const counts = useMemo(() => {
  const c = { vigentes: 0, approved: 0, overdue: 0, pending_approval: 0, cancelled: 0, payment_confirmation: 0 };
  for (const a of classifiedAgreements) {
    const cls = (a as any)._installmentClass;
    if (a.status === "pending_approval") c.pending_approval++;
    else if (a.status === "cancelled") c.cancelled++;
    else if (cls === "pago" || a.status === "approved") c.approved++;
    else if (cls === "vencido" || a.status === "overdue") c.overdue++;
    else if (cls === "pending_confirmation") c.payment_confirmation++;
    else c.vigentes++;
  }
  return c;
}, [classifiedAgreements]);

// Default mês
const [selectedMonth, setSelectedMonth] = useUrlState("month", "todos");
```

## Resultado esperado

Sabrina abre Financeiro → Acordos:
- Vê imediatamente todos os 11 acordos ativos dela (default "todos os meses").
- Cada aba mostra o contador, evidenciando onde cada acordo está.
- Se filtrar por mês e zerar, vê CTA para voltar a "todos".
