## Problema

Na **Carteira**, quando o operador seleciona linhas:
- Banner mostra **"291 registro(s) selecionado(s)"** quando na verdade são **50 clientes (CPFs)**.
- Indicador de paginação mostra **"19.573 registros"** mas já são CPFs únicos (RPC `get_carteira_grouped` agrupa por CPF).

A confusão vem de:
1. A linhagem `clients` é por parcela. A view agrupada (`get_carteira_grouped`) entrega 1 linha por CPF, mas com `all_ids[]` (ids de todas as parcelas daquele CPF/credor).
2. O state `selectedIds` armazena os **ids de parcelas** (todos os `allIds` de cada CPF marcado), porque ações em massa (hidratação de bulk, agreements, atribuições) precisam dos ids individuais.
3. O banner usa `selectedIds.size` → conta parcelas.

O `totalCount` retornado pela RPC já é a contagem de CPFs (via `COUNT(*) OVER()` na CTE agrupada), então o "19.573 registros" também é tecnicamente CPFs — só o **rótulo** está errado.

## Solução

### 1. Manter um `Set<cpf>` paralelo à seleção

Adicionar `selectedCpfs: Set<string>` que é atualizado em todos os pontos onde `selectedIds` é alterado:

- `toggleSelect(groupClient)` → adiciona/remove `groupClient.cpf` (normalizado).
- `toggleSelectAll()` → adiciona/remove todos os CPFs da página atual.
- `handleSelectAllFiltered()` → após buscar todos os IDs, também busca todos os CPFs filtrados (já trivial: usar a mesma chamada da RPC retornando `cpf` em vez de `representative_id`, ou inferir do `bulkClients` quando hidratado). Mais simples: derivar do `displayClients` + `bulkClients` ou usar `totalCount` direto quando `selectAllFiltered=true`.
- `setSelectedIds(new Set())` (limpar seleção) → também limpa `selectedCpfs`.
- `useEffect` que reseta seleção ao mudar filtros → também reseta `selectedCpfs`.

Para `handleSelectAllFiltered`, como `selectAllFiltered=true` significa "tudo", o contador exibe `totalCount` direto sem precisar do Set populado.

### 2. Trocar contagens exibidas

```tsx
// Banner de seleção acumulada (linha ~750)
<span className="font-medium">
  {(selectAllFiltered ? totalCount : selectedCpfs.size).toLocaleString("pt-BR")}
</span>{" "}
cliente(s) selecionado(s) (a seleção é mantida ao trocar de página).

// Banner "todos selecionados" (linha ~778)
Todos os {totalCount.toLocaleString("pt-BR")} clientes filtrados estão selecionados.

// Rodapé/cabeçalho de paginação (linhas 805 e 975)
<span className="ml-2">{totalCount.toLocaleString("pt-BR")} clientes</span>
```

### 3. Ajustar `selectedCount` (linhas 599-603)

Hoje há um cálculo defensivo que tenta deduplicar por CPF apenas quando "tudo está na página atual". Com `selectedCpfs` mantido sempre, isso vira:

```ts
const selectedCount = selectAllFiltered ? totalCount : selectedCpfs.size;
```

Esse `selectedCount` já é usado nos botões de ação em massa (WhatsApp, Discador, etc.) — vai passar a refletir CPFs únicos sempre.

### 4. Ajustar contador no `CarteiraTable.tsx` (linha 72)

```tsx
<span className="ml-auto text-sm text-muted-foreground">{grouped.length} clientes</span>
```

(é a contagem de grupos exibidos na página atual, que já é por CPF/credor).

## Arquivos afetados

- `src/pages/CarteiraPage.tsx` — adicionar `selectedCpfs`, atualizar nos toggles/clears, trocar textos.
- `src/components/carteira/CarteiraTable.tsx` — trocar "registros" por "clientes" no rótulo.

## Resultado

- Banner: **"50 cliente(s) selecionado(s)"** em vez de "291 registro(s) selecionado(s)".
- Rodapé: **"19.573 clientes"** em vez de "19.573 registros".
- Botão "Selecionar todos os 19.573 clientes filtrados" continua igual (já estava correto).
