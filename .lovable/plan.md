# Gestão de Acordos: Performance + Filtro de Operador

## Diagnóstico de performance

A tela hoje carrega ~498 acordos de uma vez e depois faz processamento pesado no navegador. Pontos identificados:

1. `fetchAgreements` faz `SELECT *` sem paginação e traz TODOS os acordos do tenant (mesmo cancelados/rejeitados antigos).
2. Logo em seguida, busca em paralelo TODAS as `negociarie_cobrancas` e TODOS os `manual_payments` desses 498 acordos — payload muito grande para classificar parcelas.
3. Para cada acordo, o frontend reconstrói o cronograma de parcelas (`buildInstallmentSchedule`) e classifica cada parcela (`classifyInstallment`) a cada mudança de filtro — trabalho O(N×parcelas) feito em JS.
4. Toda navegação dispara `supabase.functions.invoke("auto-expire-agreements")` de forma bloqueante antes de listar.
5. `useEffect` recarrega tudo ao trocar usuário/admin, sem cache. Sem `React Query`, voltar pra tela refaz toda a busca.
6. Avisos no console (`Function components cannot be given refs` em `AgreementsList` e `PaymentConfirmationTab`) indicam re-renders desnecessários e props mal aplicadas.

## Otimizações que serão aplicadas

**Backend / fetch**
- Tornar `auto-expire-agreements` não-bloqueante (fire-and-forget): a lista carrega imediatamente; expiração roda em background.
- Adicionar uma RPC `get_acordos_listagem(tenant_id, status_group, credor, operator_id, year, month, search, limit, offset)` que:
  - Aplica filtros (status group, credor, operador, mês/ano, busca por nome/CPF) já no Postgres.
  - Faz `LEFT JOIN profiles` para retornar `creator_name` num único round-trip.
  - Calcula `paid_count` / `total_count` por acordo via subquery agregada de `manual_payments` + `negociarie_cobrancas`, eliminando a busca paralela gigante.
  - Retorna apenas os campos usados pela tabela.
- Paginação server-side de 50 por página (com `total_count` para o rodapé).

**Frontend**
- Migrar `AcordosPage` para `useQuery` com `queryKey` baseado nos filtros, `staleTime: 30s` e `keepPreviousData` — evita refetch ao alternar abas e dá UX instantânea com cache.
- Mover a classificação por mês para um `useMemo` enxuto que opera só sobre os 50 itens da página atual (não mais 498).
- Corrigir `forwardRef` em `AgreementsList` e `PaymentConfirmationTab` para silenciar os warnings e evitar invalidações de árvore.

**Resultado esperado:** primeira renderização cai de vários segundos para <800ms; trocas de filtro/aba ficam instantâneas (cache + filtragem no servidor).

## Novo filtro: Operador

- Adicionar `<Select>` "Operador" imediatamente à direita do filtro "Credor" (mesmo padrão visual já usado na barra de filtros de Acordos).
- Opções:
  - "Todos os Operadores" (default)
  - Lista distinta de operadores que possuem acordos no tenant (label = `full_name`, value = `user_id`), ordenada alfabeticamente.
  - Item especial "Portal" para acordos originados pelo Portal do Devedor (quando `created_by` é nulo / `portal_origin = true`).
- Estado persistido na URL via `useUrlState("operator", "todos")`, igual aos outros filtros.
- O filtro é enviado para a RPC (`operator_id`), não filtra no cliente.
- Para não-admins o filtro fica oculto (continuam vendo só os próprios acordos).
- Lista de operadores vem de uma query leve separada (`SELECT DISTINCT created_by, full_name FROM agreements JOIN profiles …`) cacheada por 5 min.

## Arquivos a alterar

- `supabase/migrations/<novo>.sql` — nova RPC `get_acordos_listagem` + RPC `get_acordos_operators`.
- `src/services/agreementService.ts` — usar a nova RPC, manter API antiga apenas como fallback.
- `src/pages/AcordosPage.tsx` — React Query, novo filtro de operador, paginação, classificação reduzida ao page slice.
- `src/components/acordos/AgreementsList.tsx` — `forwardRef`, paginação no rodapé.
- `src/components/acordos/PaymentConfirmationTab.tsx` — `forwardRef`.

## Fora do escopo

- Mudanças visuais nas demais abas (Aguardando Liberação / Confirmação de Pagamento).
- Quebra dos campos financeiros (juros/multa/honorários) — fica para a iteração seguinte conforme já discutido.
