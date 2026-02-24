

## Plano: Filtro por valor em aberto + botão "Sem Contato" na Carteira

### 1. Filtro por Valor Total em Aberto

**Arquivo: `src/components/clients/ClientFilters.tsx`**

- Adicionar dois campos numéricos (usando `CurrencyInput`) na linha de datas: "Valor Aberto De" e "Valor Aberto Até"
- Novos campos na interface `Filters`: `valorAbertoDe: number` e `valorAbertoAte: number`

**Arquivo: `src/pages/CarteiraPage.tsx`**

- Adicionar `valorAbertoDe: 0` e `valorAbertoAte: 0` no estado inicial de `filters`
- No `displayClients` (useMemo), adicionar lógica de filtro:
  - Calcular valor em aberto como `c.valor_parcela - c.valor_pago`
  - Se `valorAbertoDe > 0`, filtrar apenas clientes com valor aberto >= valorAbertoDe
  - Se `valorAbertoAte > 0`, filtrar apenas clientes com valor aberto <= valorAbertoAte

### 2. Botão "Sem Contato"

**Conceito**: Clientes que nunca tiveram nenhuma interacao — sem registros em `call_dispositions` (tabulacoes de discador/operador) e sem conversas em `conversations` (WhatsApp).

**Arquivo: `src/components/clients/ClientFilters.tsx`**

- Adicionar checkbox "Sem contato" ao lado de "Sem acordo" e "Quitados" na linha 3 de checkboxes
- Novo campo na interface `Filters`: `semContato: boolean`

**Arquivo: `src/pages/CarteiraPage.tsx`**

- Adicionar `semContato: false` no estado inicial
- Criar query para buscar CPFs que tiveram contato:
  1. Buscar CPFs distintos de `call_dispositions` (tabulacoes feitas por operadores/discador)
  2. Buscar telefones/CPFs distintos de `conversations` (conversas WhatsApp)
  3. Unir em um Set de CPFs "contatados"
- No `displayClients`, se `semContato === true`, filtrar apenas clientes cujo CPF NAO esta no Set de contatados

### Detalhes tecnicos

- `CurrencyInput` ja existe em `src/components/ui/currency-input.tsx` e sera reutilizado
- A query de contatos usa `call_dispositions` (vinculada por `client_id`) — sera necessario buscar os `client_id` que possuem tabulacao e cruzar com os clientes carregados
- Para `conversations`, o campo `contact_phone` pode ser cruzado com `phone` dos clientes
- Ambas as queries sao leves (apenas select de IDs/CPFs distintos)

