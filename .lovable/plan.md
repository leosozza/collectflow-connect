## Problema observado (print)

- Banner: **"197 registro(s) selecionado(s)"** ✅ correto (acumulado entre páginas).
- Botões no topo: **"WhatsApp (50)"**, **"Discador (50)"**, **"Higienizar (50)"** ❌ mostram só os da página atual.
- Quando o operador trocava `pageSize` de 50 para 20, **toda a seleção acumulada era perdida** (effect zerava `selectedIds`).

## Causas identificadas em `src/pages/CarteiraPage.tsx`

### Bug 1 — Contador dos botões ignora seleções de páginas anteriores

Linhas 586-589:
```ts
const selectedClients = displayClients.filter((c) => selectedIds.has(c.id));
const selectedCount = selectAllFiltered
  ? totalCount
  : new Set(selectedClients.map(c => c.cpf.replace(/\D/g, ""))).size;
```
`displayClients` contém apenas a página atual. Os IDs que ficaram em `selectedIds` vindos de outras páginas são descartados pelo `.filter`, então `selectedCount` exibe apenas a contagem da página visível (50), em vez do total real (197).

### Bug 2 — Trocar `pageSize` apaga a seleção acumulada

Linhas 510-520 (effect de `pageSize`):
```ts
useEffect(() => {
  if (prevPageSizeRef.current !== pageSize) {
    prevPageSizeRef.current = pageSize;
    setUrlPage(1);
    setSelectedIds(new Set());          // ← apaga 197 seleções
    setSelectAllFiltered(false);
    setBulkClients(null);
  }
}, [pageSize]);
```
UX ruim: o operador só queria visualizar menos itens por página, não perder o trabalho de seleção. Coerente com a regra "seleção é mantida ao trocar de página", trocar o tamanho da página também não deve descartar a seleção.

## Correções propostas

### 1. `selectedCount` reflete o total acumulado real

Substituir o cálculo (linhas 586-589) por uma lógica que prioriza o total acumulado em `selectedIds`, e só usa a contagem por CPF único quando toda a seleção está contida na página visível (caso em que o agrupamento por CPF faz sentido):

```ts
const selectedClients = displayClients.filter((c) =>
  (c.allIds || [c.id]).some((id: string) => selectedIds.has(id))
);

const selectedCount = selectAllFiltered
  ? totalCount
  : selectedClients.length === new Set(Array.from(selectedIds)).size
    ? new Set(selectedClients.map(c => c.cpf.replace(/\D/g, ""))).size
    : selectedIds.size;
```

Na prática:
- **50 selecionados, todos da página atual** → mostra "50" (CPFs únicos da página).
- **197 acumulados de várias páginas** → mostra "197" (total real, igual ao banner).
- **Selecionar todos os filtrados** → mostra `totalCount` (já estava correto).

Também substitui o `.filter` original (`selectedIds.has(c.id)`) pela versão que considera `c.allIds` — corrige um pequeno desalinhamento com o agrupamento usado no checkbox de cada linha (`toggleSelect` opera sobre `allIds`).

### 2. Preservar `selectedIds` ao trocar `pageSize`

Reescrever o effect das linhas 510-520 para apenas resetar a página e o flag `selectAllFiltered`, preservando a seleção acumulada:

```ts
const prevPageSizeRef = useRef(pageSize);
useEffect(() => {
  if (prevPageSizeRef.current !== pageSize) {
    prevPageSizeRef.current = pageSize;
    setUrlPage(1);
    setSelectAllFiltered(false);
  }
}, [pageSize]);
```

`bulkClients` também não precisa mais ser invalidado aqui — ele é invalidado em qualquer mudança de seleção (`toggleSelect`, `toggleSelectAll`, "Limpar seleção") e em mudança de filtros. O `pageSize` em si não muda quem está selecionado.

## Resultado esperado

- Selecionar 50 + navegar páginas + acumular 197 → banner e botões mostram **197** consistentemente.
- Trocar de 50 → 20 itens por página → seleção de **197 é preservada**, página volta para 1.
- Disparo (WhatsApp/Discador/Higienizar) envia para todos os 197 (já garantido pelo `fetchBulkIfNeeded` que hidrata via `fetchCarteiraClientsByIds` quando há IDs fora da página atual).

## Arquivos afetados

- `src/pages/CarteiraPage.tsx` — apenas duas pequenas alterações (effect do `pageSize` + cálculo de `selectedCount`/`selectedClients`).

## Fora de escopo

- Nenhuma alteração em service, RPC ou outras páginas.
