## Diagnóstico (causa-raiz de cada problema)

Rodei queries no banco da Y.BRASIL e li o código atual. Os números zerados **não são bug de UI** — são consequência de modelagem errada da inadimplência no frontend:

1. **Select de Credor (Prestação de Contas)** — `ReportFiltersBar` lista `credores.nome`, mas `PrestacaoContasView` inicia `credor=""` e usa `Select` do shadcn. Quando `credorRequired=true` o item `__all__` é escondido, então o select abre vazio se a `useQuery` ainda não respondeu ou se algum nome vem `null`. Além disso `onCredor?.(v)` recebe valor mas o disparador visual fica "preso" porque `value=""` é estado inválido para Radix `Select`. Resultado: clicar não seleciona.

2. **Análise da Carteira retornou erro na primeira abertura** — o `useQuery` do funil dispara antes de `tenant?.id` resolver em algumas rotas; faltou `retry` + tratamento. Toast só dispara em render seguinte, sem fallback visual.

3. **Saldo Inadimplente R$ 0,00 / Parcelas Inadimplentes 0 / Aging zerado** — causa real confirmada por SQL na Y.BRASIL:
   - 467.428 `clients` total, 14.994 `status='pendente'`
   - **MIN(data_vencimento) entre pendentes = 2026-05-18 (hoje)** → todas as parcelas pendentes têm vencimento ≥ hoje, então `parseISO(data_vencimento) < now` legitimamente retorna 0
   - Além disso a view busca apenas `pageSize=500` em JS sobre uma base de 467k → amostra inválida
   - O modelo correto de "inadimplência real" precisa unir: (a) `clients` com status pendente cujo `agreement` esteja `broken`/`overdue`, (b) `agreement_installments` vencidas e não pagas, (c) saldo original via `valor_saldo`. Não dá pra calcular em JS.

4. **Base ATIVA = 1624 (Y.BRASIL com 467k CPFs)** — `get_bi_collection_funnel` define "base ativa" como CPFs que tiveram **algum acionamento no período do filtro** (call_logs ∪ chat_messages ∪ atendimento_sessions ∪ agreements criados entre `_date_from` e `_date_to`). Com filtro padrão "mês atual" (01/05–18/05), 1624 CPFs realmente foram acionados. **Não é a base total da carteira** — é a base operada. Precisamos renomear o rótulo e adicionar um KPI separado "Base Total (CPFs distintos)".

5. **Aging zerado** — mesma causa do #3: filtra `pendente && vencimento<hoje` sobre amostra de 500.

6. **Skeletons** — já existem nos cards de KPI e gráficos das views novas, mas o **Hub raiz** e a transição Hub→View não têm fallback; a tela "pisca" branco enquanto carrega.

## Plano de correção

### 1. Nova RPC `get_carteira_overview(tenant_id, credor?)` *(server-side, indispensável)*

Função SQL `STABLE SECURITY DEFINER` que devolve em uma chamada:

```text
total_cpfs_base       -- COUNT(DISTINCT cpf) WHERE tenant
cpfs_inadimplentes    -- COUNT(DISTINCT cpf) com pendência real
parcelas_inadimplentes-- COUNT parcelas em atraso (mantido p/ ref)
saldo_inadimplente    -- soma do valor_saldo + parcelas vencidas em aberto + quebras de acordo
saldo_quebra_acordos  -- soma agreements.status='broken' saldo restante
aging_0_30, 31_90, 91_180, 181_365, 366_plus  -- buckets em valor e em qtd
ticket_medio_inadimplencia
```

Fonte canônica de "inadimplência real" (alinhada com memórias do projeto):

- `clients` com `status='pendente'` **E** (`data_vencimento < CURRENT_DATE` **OU** existe agreement vinculado com `status IN ('broken','cancelled')`)
- `agreement_installments` com `due_date < CURRENT_DATE AND paid_amount < amount`
- Soma de `valor_saldo` quando presente; fallback `valor_parcela - valor_pago`
- Sempre filtrado por `tenant_id` e respeitando `_credor` quando passado

Isso elimina a leitura de 500 linhas em JS e responde os 4 KPIs + aging em uma única chamada.

### 2. Fix do select de Credor (Prestação de Contas)

- Em `PrestacaoContasView`, inicializar `credor` como `undefined` e usar `value={credor ?? undefined}` no `Select` (Radix exige `undefined` em vez de `""`)
- Em `ReportFiltersBar`, filtrar `credores.filter(Boolean)` já existe — adicionar fallback de loading com `Skeleton` no trigger e desabilitar o trigger enquanto a query não retornou
- Garantir `disabled={isLoading || credores.length===0}` e mostrar "Nenhum credor cadastrado" quando vazio
- Adicionar `key={credores.length}` no `Select` para forçar remount após carregar

### 3. Refatorar `CarteiraAnaliseView`

- Trocar `fetchClients` + cálculo em JS por `supabase.rpc('get_carteira_overview', {...})`
- KPIs novos:
  - "CPFs Inadimplentes" (substitui "Parcelas Inadimplentes" — mostra `cpfs_inadimplentes`; mantém "Parcelas em atraso" como linha secundária menor)
  - "Saldo Inadimplente Real" = `saldo_inadimplente + saldo_quebra_acordos` (vermelho)
  - "Ticket Médio" = `saldo / cpfs_inadimplentes`
- Aging vem direto do RPC (5 buckets já com valor + qtd + %)
- Adicionar `retry: 1` e `<EmptyBlock>` quando RPC erra, no lugar de tabela vazia silenciosa

### 4. Renomear/explicar "Base Ativa" no funil

- Rótulo passa a ser **"Base Operada no Período"**
- Tooltip: "CPFs com pelo menos um acionamento (ligação, mensagem, sessão ou acordo) entre {dateFrom} e {dateTo}. Para ver a carteira inteira, consulte o KPI 'CPFs na Base' acima."
- Acima do funil, adicionar uma linha de contexto: `Base total da carteira: {total_cpfs_base} CPFs | Operados no período: {1624} ({pct}%)`

### 5. Prestação de Contas — usar mesma fonte real

- "Valor Pendente" do KPI passa a vir do `get_carteira_overview` (filtrado pelo credor selecionado) — hoje vem de `get_bi_revenue_summary` que considera só acordos firmados no período
- Mantém negociado/recebido/quebra do `get_bi_revenue_summary` (já está correto)
- Devedores: trocar `pageSize: 200` por paginação real ou aumentar com aviso visual ("mostrando primeiros 500 de N")

### 6. Skeletons consistentes em todas as views

- `RelatoriosPage`: Suspense de carregamento de `tenant` com `<Skeleton className="h-32" />` em vez de tela branca
- `ReportHub`: grid de 4 `<Skeleton className="h-40 rounded-2xl" />` durante mount
- Cada view: já tem skeleton nos KPIs — adicionar também no `ReportFiltersBar` (trigger do credor) e no cabeçalho durante primeiro paint

### 7. Tratamento de erro amigável

- Wrapper `useReportQuery` (`retry: 1`, `staleTime: 60s`, `onError` com `toast.error` informativo) reaproveitado por todas as views
- Componente `<ReportErrorState onRetry/>` exibido inline quando a RPC falha (em vez de só toast + tela vazia)

---

## Arquivos

### Migração nova
- `get_carteira_overview` (SQL via `supabase--migration`)

### Editar
- `src/components/relatorios/views/CarteiraAnaliseView.tsx` — usar nova RPC, novos KPIs, aging real, contexto de Base
- `src/components/relatorios/views/PrestacaoContasView.tsx` — fix select credor (estado `undefined`), usar saldo real no KPI Pendente
- `src/components/relatorios/shared/ReportFiltersBar.tsx` — skeleton no trigger, disabled enquanto carrega, remount key
- `src/pages/RelatoriosPage.tsx` — skeleton no carregamento inicial
- `src/components/relatorios/ReportHub.tsx` — skeleton grid

### Criar
- `src/hooks/useReportQuery.ts` — wrapper TanStack padrão
- `src/components/relatorios/shared/ReportErrorState.tsx` — UI de erro com retry

## Garantias de não-quebra (produção)

- **Zero alteração** em RPCs existentes (`get_bi_collection_funnel`, `get_bi_revenue_summary`, `get_bi_breakage_analysis`, `get_carteira_grouped`)
- Nova RPC é **aditiva** e SECURITY DEFINER com `tenant_id` obrigatório + RLS-equivalente
- Nenhuma mudança em `clients`, `agreements`, edge functions ou serviços de escrita
- Dashboard, Analytics, Carteira, Acordos: intocados
- Cobre Y.BRASIL e demais tenants (filtro por `tenant_id` em todas as CTEs)

Pronto para implementar ao aprovar.