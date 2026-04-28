## Objetivo

Na página **Carteira**, permitir que o operador acumule a seleção de clientes ao navegar entre páginas (ex.: 1000 da página 1 + 1000 da página 2 + ...) para conseguir disparar discador/WhatsApp para 5000+ clientes. Também adicionar a opção de **20 itens por página** ao seletor de paginação.

## Diagnóstico atual (`src/pages/CarteiraPage.tsx`)

1. **Seleção é zerada implicitamente entre páginas** — embora o `setSelectedIds` não seja chamado diretamente ao mudar `currentPage`, dois comportamentos quebram a acumulação:
   - **Checkbox do cabeçalho da tabela (`toggleSelectAll`, linhas 482-490)**: quando o usuário muda de página com 1000 já selecionados e clica no checkbox "selecionar todos" da nova página, o código faz `setSelectedIds(new Set(allClientIds))` — **substituindo** a seleção anterior em vez de **somar** os novos IDs.
   - **Estado `checked` do checkbox header (linha 801)**: usa `selectedIds.size === allClientIds.length`, que dá falso positivo entre páginas com mesmo tamanho.
2. **Banner "Selecionar todos os filtrados"** (linha 698) só aparece quando `selectedIds.size === allClientIds.length`. Após acumular entre páginas isso não bate mais e o banner some.
3. **Seletor de "Itens por página"** (linhas 740 e 910) tem apenas `[50, 100, 200, 500, 1000]` — falta o **20**.
4. **Reset ao trocar `pageSize`** (linhas 497-506) chama `setSelectedIds(new Set())` — correto manter, pois muda o universo da página.

## Mudanças propostas

### 1. Acumular seleção entre páginas (`src/pages/CarteiraPage.tsx`)

**`toggleSelectAll` (linhas 482-490)** — passar a operar **apenas sobre os IDs da página atual**, somando/removendo do conjunto existente, sem descartar seleções de outras páginas:

```ts
const allCurrentPageSelected =
  allClientIds.length > 0 &&
  allClientIds.every((id) => selectedIds.has(id));

const toggleSelectAll = () => {
  const next = new Set(selectedIds);
  if (allCurrentPageSelected) {
    // Desmarca apenas os desta página, preserva páginas anteriores
    allClientIds.forEach((id) => next.delete(id));
  } else {
    allClientIds.forEach((id) => next.add(id));
  }
  setSelectedIds(next);
  setSelectAllFiltered(false);
};
```

**Checkbox do header (linha 801)** — usar `allCurrentPageSelected` em vez de comparar tamanhos:

```tsx
<Checkbox
  checked={allCurrentPageSelected}
  onCheckedChange={toggleSelectAll}
/>
```

**Banner "Selecionar todos os filtrados" (linha 698)** — exibir sempre que houver seleção parcial relevante e ainda existirem mais registros que o selecionado:

```tsx
{selectedIds.size > 0 && totalCount > selectedIds.size && !selectAllFiltered && (
  <div className="...">
    {selectedIds.size.toLocaleString("pt-BR")} cliente(s) selecionado(s)
    {" "}(acumulando entre páginas).{" "}
    <Button onClick={handleSelectAllFiltered} ...>
      Selecionar todos os {totalCount.toLocaleString("pt-BR")} clientes filtrados
    </Button>
    {" · "}
    <Button variant="link" onClick={() => setSelectedIds(new Set())}>
      Limpar seleção
    </Button>
  </div>
)}
```

**Garantir que NÃO há reset de `selectedIds` ao mudar `currentPage`** — confirmar que o effect das linhas 492-495 só zera `selectAllFiltered` (já está correto) e que o effect do `rpcFiltersKey` (283-289) continua zerando seleção apenas em mudança de filtro (já está correto).

### 2. Adicionar opção de 20 itens por página

Atualizar os dois seletores (linhas 740 e 910) para incluir `20`:

```tsx
{[20, 50, 100, 200, 500, 1000].map((size) => (
  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
))}
```

### 3. Considerações sobre dialogs em massa (Discador / WhatsApp)

O fluxo atual em `fetchBulkIfNeeded` (linhas 535-548) usa `displayClients.filter((c) => selectedIds.has(c.id))` quando `selectAllFiltered` é falso. Isso só retorna clientes da **página atualmente carregada** — não funciona para uma seleção acumulada entre páginas.

Solução: quando `selectedIds` contém IDs que não estão em `displayClients` (caso da seleção acumulada), buscar os GroupedClients correspondentes via uma chamada de hidratação no service. Adicionar em `src/services/clientService.ts` uma função `fetchCarteiraClientsByIds(tenantId, ids: string[]): Promise<GroupedClient[]>` que faz `SELECT` em chunks de 500 IDs e reagrupa pelo mesmo formato `GroupedClient` esperado pelos dialogs (mantendo o padrão dos demais bulks já existentes na página).

Atualizar `fetchBulkIfNeeded` para:
- Se `selectAllFiltered` → usa `fetchAllCarteiraClients` (atual).
- Senão, se todos `selectedIds` estão em `displayClients` → filtro local (atual).
- Senão → chama `fetchCarteiraClientsByIds(tenant.id, Array.from(selectedIds))` e cacheia em `bulkClients`.

### 4. Atualização do contador `selectedCount` (linhas 551-553)

Manter o cálculo por CPF único, mas considerando o conjunto acumulado. Para UX clara, no botão de ações em massa exibir tanto a contagem de **registros** (`selectedIds.size`) quanto de **CPFs únicos**, sem mudança de comportamento.

## Arquivos afetados

- `src/pages/CarteiraPage.tsx` — `toggleSelectAll`, banner, checkbox header, opções de pageSize (2 lugares), `fetchBulkIfNeeded`.
- `src/services/clientService.ts` — nova função `fetchCarteiraClientsByIds` (chunked por 500 IDs respeitando o limite de 1000 do PostgREST).

## Fora de escopo

- Não alterar a página `Clientes` (`src/pages/ClientsPage.tsx`) — esse fluxo de seleção em massa é exclusivo da Carteira.
- Não mexer no Kanban — paginação ali já é desabilitada.
- Não mexer na RPC `get_carteira_grouped`.

## Resultado esperado

- Operador seleciona 1000 da página 1 → clica "Próxima" → seleção dos 1000 anteriores é **mantida** → seleciona 1000 da página 2 → contador mostra 2000 → repete até atingir 5000+ → clica em "Disparar discador" e o sistema envia para todos os 5000 selecionados (não apenas os da página atual).
- Seletor de itens por página passa a oferecer **20, 50, 100, 200, 500, 1000**.
