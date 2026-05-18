## Central de Relatórios — Reformulação Completa

Transformar `src/pages/RelatoriosPage.tsx` em um Hub central premium com 4 relatórios especializados, eliminando o bug de truncamento via reuso dos RPCs já validados pelo Analytics. Zero alteração em RPCs, schema, RLS, edge functions ou serviços de escrita — só frontend de leitura.

### 1. Novo Hub (RelatoriosPage.tsx)

Substituir as abas atuais por um grid premium de 4 cards (glassmorphism, gradientes sutis, ícones Lucide vibrantes, paleta Rivo):

- **Prestação de Contas** (`FileText`) — reconciliação financeira por credor
- **Análise da Carteira** (`Wallet`) — raio-X de inadimplência e aging
- **Desempenho de Negociações** (`TrendingUp`) — funil, descontos, operadores
- **Acionamentos e Canais** (`Radio`) — efetividade WhatsApp/Portal/Ligação

Estado local `activeReport: string | null` controla Hub vs. View. Cada View renderiza `<BackToHub />` no cabeçalho + barra de ações (Excel/PDF) + filtros próprios. Transição com `animate-fade-in`.

### 2. Views detalhadas — todas via RPC (sem agregação em JS)

Todas as queries usam `tenant.id` no payload e respeitam RLS automaticamente.

**A. PrestacaoContasView** (substitui o atual `PrestacaoContas.tsx`)
- Seletor de credor **obrigatório** no topo (view vazia até escolher)
- KPIs via `get_financial_summary({ _tenant_id, _date_from, _date_to, _credor: [selectedCredor], _operator_ids: null })` → `total_negociado`, `total_recebido`, `total_pendente`, `total_quebra`
- Taxa de Recuperação Real = `recebido / (recebido + quebra) * 100`
- Tabela de devedores via `fetchClients(tenant.id, { credor: selectedCredor }, { page: 1, pageSize: 200 })` — paginação server-side resolve o truncamento de 1000
- Acordos do credor via `get_agreement_financials` filtrado client-side por credor (já hoje é a fonte de `total_paid_real`/`pending_balance_real`)

**B. CarteiraAnaliseView**
- `get_bi_collection_funnel(params)` → quanto da base entrou em negociação
- `fetchClients` filtrado por credor → ticket médio, total parcelas inadimplentes, tabela de aging (0-30, 31-90, 91-180, 181-365, 366+) calculada sobre `data_vencimento` (cálculo simples sobre o conjunto já paginado pelo credor)

**C. NegociacoesDesempenhoView**
- `get_bi_operator_performance(params)` → conversão por operador, ticket, desconto médio
- `get_bi_breakage_analysis(params)` → incidência e motivos de quebra
- Tabelas + barras simples (Recharts já no projeto)

**D. AcionamentosCanaisView**
- `get_bi_channel_performance(params)` → volumetria e retorno por canal
- Gráfico de barras + tabela detalhada

Todos os params seguem o tipo `AnalyticsRpcParams` (`useAnalyticsFilters`), reaproveitando a barra de filtros (período, credor, operador) onde fizer sentido.

### 3. Resolução do bug de truncamento

Causa raiz atual: `RelatoriosPage` chama `fetchClients(tenant.id)` sem filtros e itera 1000 linhas em JS, depois `PrestacaoContas` cruza por CPF na memória.

Correção: cada View busca **somente** o recorte necessário (credor selecionado, page-size dimensionado) via filtros server-side já suportados por `fetchClients`. Os KPIs financeiros vêm de RPC consolidado — fonte única de verdade igual ao Analytics.

### 4. Exportação Premium

Barra fixa no topo de cada View:
- **Excel**: `exportMultiSheetExcel` (já existe em `src/lib/exportUtils.ts`) com abas dedicadas (KPIs, Detalhamento, Balanço quando aplicável)
- **PDF**: `printSection(reportRootId)` envolvendo `print:hidden` em filtros/menus e `print-target` na seção ativa

### 5. Padrão visual

- Cards do Hub: `rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition`
- Ícones em círculo com `bg-primary/10 text-primary`
- `Skeleton` em todas as queries TanStack
- Toasts (`use-toast`) em onError de cada `useQuery`
- Tipografia e tokens existentes (Outfit/Inter, semantic tokens), nada de cores hardcoded

### Arquivos a criar

```
src/components/relatorios/
  ReportHub.tsx                  — grid de 4 cards
  views/PrestacaoContasView.tsx  — substitui PrestacaoContas.tsx (mantido até validar)
  views/CarteiraAnaliseView.tsx
  views/NegociacoesDesempenhoView.tsx
  views/AcionamentosCanaisView.tsx
  shared/ReportHeader.tsx        — voltar + título + ações export
  shared/KpiGrid.tsx             — grid reutilizável de KPIs
```

### Arquivos a editar

- `src/pages/RelatoriosPage.tsx` — reescrito como roteador Hub ↔ View, mantendo `useScrollRestore` e isolamento por `tenant.id`

### Garantias de não-quebra (produção)

- Nenhuma migração, RPC, edge function ou serviço de escrita é tocado
- `EvolutionChart`, `AgingReport`, `ReportFilters`, `OperatorRanking` permanecem disponíveis e podem ser reusados dentro das novas views
- `PrestacaoContas.tsx` atual permanece no repo até a nova view ser validada (remoção em PR separado)
- Y.brasil e demais tenants: leitura via RLS com `tenant.id`, mesma fonte que Analytics já consome em produção
- Sem mudança em rotas, permissões, ou contratos de API

### Detalhes técnicos

- RPCs já presentes em `src/components/analytics/tabs/*` (Funnel, Performance, Channels, Quality) — copiar o padrão `useQuery` + `supabase.rpc(name, params as any)`
- `useAnalyticsFilters(tenant.id)` reaproveitado para montar `AnalyticsRpcParams` consistente
- `fetchClients` aceita `{ credor, dateFrom, dateTo, operatorId }` e paginação — assinatura intacta
- Print: `@media print` já tratado por classes `print:hidden` e `printing-section` em `exportUtils.printSection`

Pronto para implementar após aprovação.
