

## Plano: Corrigir filtro "Status de Acordo" na Carteira

### Problema identificado

O filtro "Status de Acordo" esta filtrando pelo campo `clients.status` (pendente/pago/quebrado), que e o status de pagamento da parcela. Isso mostra TODOS os clientes, independente de terem acordo formalizado ou nao.

O correto e filtrar pelo campo `agreements.status` (pending/approved/rejected/cancelled), mostrando APENAS clientes que possuem acordos registrados na tabela `agreements`.

### Mudancas

**Arquivo: `src/components/clients/ClientFilters.tsx`**

Alterar as opcoes do select "Status do Acordo" para refletir os status reais da tabela `agreements`:
- Todos (nao filtra)
- Pendente (pending)
- Aprovado (approved)
- Rejeitado (rejected)
- Cancelado (cancelled)

**Arquivo: `src/pages/CarteiraPage.tsx`**

1. Alterar a query `agreement-cpfs` para ser dinamica: quando `filters.status` != "todos", buscar apenas acordos com aquele status especifico. Quando "todos", nao filtrar por status.

2. No `displayClients`, quando `filters.status` != "todos", filtrar clientes para mostrar APENAS aqueles cujo CPF aparece na lista de CPFs retornados pela query de agreements com o status selecionado.

3. Remover o filtro atual em `fetchClients` que usa `filters.status` como `clients.status` -- o campo `status` do filtro agora se refere exclusivamente a acordos.

**Arquivo: `src/services/clientService.ts`**

Remover o filtro por `status` da funcao `fetchClients`, pois esse campo agora e tratado no frontend via a query de agreements.

**Arquivo: `src/pages/ClientsPage.tsx`**

Aplicar a mesma logica: quando "Status de Acordo" esta ativo, buscar CPFs da tabela agreements e filtrar localmente.

### Detalhes tecnicos

| Arquivo | Mudanca |
|---|---|
| `ClientFilters.tsx` | Opcoes: pending/approved/rejected/cancelled em vez de pendente/pago/quebrado |
| `CarteiraPage.tsx` | Query de agreements dinamica por status; filtrar displayClients por CPFs com acordo |
| `clientService.ts` | Remover filtro `status` de `fetchClients` |
| `ClientsPage.tsx` | Adicionar query de agreements e filtro por CPF |

