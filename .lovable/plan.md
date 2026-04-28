# Filtro "Primeira Parcela" na Carteira

## Objetivo

Adicionar um novo intervalo de datas no painel de filtros da Carteira chamado **"Primeira Parcela De / Até"**, ao lado de "Valor Aberto Até". Diferente do filtro atual "Vencimento De/Até" (que filtra qualquer parcela individual), este novo filtro considera apenas o **vencimento da primeira parcela do cliente** (ou seja, o `MIN(data_vencimento)` agrupado por CPF + credor).

Isso resolve o caso descrito: filtrar apenas clientes cuja **primeira parcela** venceu em jan/2025, sem retornar clientes que apenas têm uma parcela qualquer dentro do período.

## Comportamento

- O filtro atual "Vencimento De/Até" continua funcionando como hoje (filtra parcelas individuais).
- O novo filtro "Primeira Parcela De/Até" é **independente** e pode ser combinado.
- Quando preenchido, retorna apenas grupos (CPF+credor) cuja **menor data de vencimento** dentro do grupo cai no intervalo informado.
- Aplica-se sobre o mesmo conjunto de parcelas já filtrado pelos demais critérios (credor, status, etc.), para coerência (ex.: se o usuário filtrar por credor X, a "primeira parcela" considera apenas as parcelas daquele credor).

## Mudanças

### 1. RPC `get_carteira_grouped` (nova migração SQL)

Adicionar dois parâmetros opcionais: `_primeira_parcela_de date`, `_primeira_parcela_ate date`. Aplicar o filtro **após o agrupamento** via `HAVING` em cima do `MIN(f.data_vencimento)`:

```sql
HAVING (_primeira_parcela_de IS NULL OR MIN(f.data_vencimento) >= _primeira_parcela_de)
   AND (_primeira_parcela_ate IS NULL OR MIN(f.data_vencimento) <= _primeira_parcela_ate)
```

Manter a assinatura retrocompatível (parâmetros com `DEFAULT NULL` ao final).

### 2. `src/services/clientService.ts`

- Estender a interface `CarteiraFilters` com `primeiraParcelaDe?: string; primeiraParcelaAte?: string`.
- Em `fetchCarteiraGrouped`, `fetchAllCarteiraIds` e `fetchAllCarteiraClients`, repassar `_primeira_parcela_de` / `_primeira_parcela_ate` quando preenchidos.

### 3. `src/components/clients/ClientFilters.tsx`

- Adicionar `primeiraParcelaDe: string` e `primeiraParcelaAte: string` à interface `Filters`.
- Renderizar dois novos inputs `type="date"` na **Linha 3 (Valor em aberto)**, ao lado direito de "Valor Aberto Até", com labels "Primeira Parcela De" e "Primeira Parcela Até". Ajustar a grid para `sm:grid-cols-4` para acomodar os 4 campos lado a lado, mantendo o padrão visual atual.

### 4. `src/pages/CarteiraPage.tsx`

- Criar dois novos `useUrlState` (`primeiraParcelaDe`, `primeiraParcelaAte`) com default `""`.
- Incluir nos objetos `filters`, `FILTER_DEFAULTS`, `hasActiveFilters` e `rpcFilters` (mapeando para `primeiraParcelaDe`/`primeiraParcelaAte` no payload).
- Replicar o padrão usado em `cadastroDe`/`cadastroAte`.

## Diagrama de fluxo

```text
UI (ClientFilters)
   └─ primeiraParcelaDe / primeiraParcelaAte
        └─ URL state (CarteiraPage)
             └─ rpcFilters
                  └─ fetchCarteiraGrouped
                       └─ RPC get_carteira_grouped
                            └─ HAVING MIN(data_vencimento) BETWEEN _de AND _ate
```

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — recriar `get_carteira_grouped` com os 2 novos parâmetros + `HAVING`.
- `src/services/clientService.ts`
- `src/components/clients/ClientFilters.tsx`
- `src/pages/CarteiraPage.tsx`

## Não altera

- Lógica do filtro "Vencimento De/Até" existente.
- Demais consumidores da RPC (parâmetros novos são opcionais).
- Permissões / RLS / mascaramento de dados.
