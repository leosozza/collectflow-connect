# Refatoração da AnalyticsPage com 6 abas usando RPCs de BI

## Objetivo

Transformar a `AnalyticsPage` atual em uma tela de BI organizada em 6 abas, alimentada pelas 16 RPCs `get_bi_*` já criadas e validadas. Toda a agregação acontece no banco; o frontend apenas renderiza.

Apenas `src/pages/AnalyticsPage.tsx` e novos componentes auxiliares dentro de `src/components/analytics/` serão criados/editados. Nenhuma outra página, RPC ou tabela será tocada.

## Estrutura visual (mantém padrão RIVO)

- Mesmo header da página atual: botão voltar + título "Analytics" + ícone de export.
- Cards usam as classes já presentes: `bg-card rounded-xl border border-border shadow-sm`, KPI label `text-[11px] uppercase tracking-wide text-muted-foreground font-semibold`, valores `text-xl font-bold tabular-nums`, ícone primário em `bg-primary/10` (laranja RIVO).
- Charts via `recharts` com `hsl(var(--*))` (mesmas cores de status já definidas no arquivo atual).
- Tabs via `@/components/ui/tabs` (shadcn). Ícone por aba (lucide).
- Tooltip de explicação reaproveita o `InfoTooltip` existente.

## Filtros globais (topo, abaixo do header)

Componente `AnalyticsFiltersBar`:
- Período: dois `Popover + Calendar` (date-from / date-to). Default: últimos 30 dias.
- Credor: `MultiSelect` (já usado na versão atual — opções vindas de `get_bi_revenue_by_credor` + fallback de `clients`).
- Operador: `MultiSelect` (mantém a query de `profiles` já existente, condicionada a admin).
- Canal: `MultiSelect` com opções fixas `whatsapp`, `voice`, `email`, `sms`, `portal` — exibido apenas em abas Canais/Funil/Performance.
- Score: dois inputs numéricos 0–100 — exibido apenas em Inteligência/Funil.

Estado via `useUrlState` (mantém o padrão atual). Os filtros viram payload para todas as RPCs:
```ts
{ _tenant_id, _date_from, _date_to, _credor, _operator_ids, _channel, _score_min, _score_max }
```

## Aba 1 — Receita

RPCs: `get_bi_revenue_summary`, `get_bi_revenue_by_period`, `get_bi_revenue_by_credor`, `get_bi_revenue_comparison`.

- 4 KPI cards: Total Recebido, Total Negociado, Total Pendente, Ticket Médio.
- `LineChart` evolução por período (granularidade automática: `day` se ≤ 31 dias, `week` se ≤ 90, senão `month`).
- Tabela "Ranking de Receita por Credor" (top 10): credor, qtd_acordos, negociado, recebido, pendente, ticket médio.
- Bloco "Comparativo período x período anterior" — 4 chips com `metric`, valor atual, anterior, `variation_pct` colorido (verde/vermelho).

## Aba 2 — Funil

RPCs: `get_bi_collection_funnel`, `get_bi_funnel_dropoff`.

- Funil visual em 5 barras horizontais (`base_ativa_periodo`, `contato_efetivo`, `negociacao`, `acordo`, `pagamento`) com qtd e `conversao_pct`. Largura proporcional ao maior valor; clamp em 100%.
- Tabela "Drop-off por credor" — credor, stage, qtd, dropoff_pct.
- Garantia: nenhum `conversao_pct > 100` é renderizado (proteção extra `Math.min(v, 100)`).

## Aba 3 — Performance

RPCs: `get_bi_operator_performance`, `get_bi_operator_efficiency`.

- Tabela ranking por operador: nome, qtd_acordos, total_recebido, qtd_calls, taxa_cpc, taxa_quebra.
- `BarChart` "Conversão por operador" (qtd_conversoes / qtd_chamadas).
- KPI cards: Acordos/hora médio, Talk-time total (formatado HH:MM:SS).

## Aba 4 — Canais

RPCs: `get_bi_channel_performance`, `get_bi_response_time_by_channel`.

- Tabela: canal, interações, clientes únicos, acordos atribuídos, taxa_conversao, total_recebido_atribuido.
- Tabela tempo de resposta: canal, avg, p50, p90, qtd_amostras (formatados em segundos/minutos).

## Aba 5 — Qualidade

RPCs: `get_bi_breakage_analysis`, `get_bi_breakage_by_operator`, `get_bi_recurrence_analysis`.

- KPI cards: Total quebras, Valor perdido, Taxa de recorrência.
- Tabela quebras por motivo (motivo, qtd, valor_perdido, pct).
- Tabela quebras por operador (operador, qtd_acordos, qtd_quebras, taxa_quebra, valor_perdido).
- Tabela top CPFs recorrentes (parsing do `top_cpfs` jsonb): cpf, nome, qtd_acordos, total_negociado.

## Aba 6 — Inteligência

RPCs: `get_bi_score_distribution`, `get_bi_score_vs_result`, `get_bi_top_opportunities`.

- `BarChart` Distribuição por faixa de score (score_band x qtd_clientes, % no tooltip).
- Tabela "Score vs Resultado": score_band, qtd_clientes, qtd_acordos, taxa_conversao, taxa_quebra, total_recebido.
- Tabela top oportunidades: cpf, nome, credor, score, valor_em_aberto, ultimo_contato_at.

## Padrões técnicos

- React Query: cada aba dispara apenas suas RPCs no mount/quando filtros mudam. `queryKey` inclui todos os filtros.
- `enabled: !!tenant?.id && activeTab === 'X'` — abas só carregam ao serem visualizadas.
- Estado da aba ativa em URL via `useUrlState("tab", "receita")`.
- Loading: `Skeleton` shadcn dentro de cada bloco.
- Empty: card centralizado com texto cinza "Sem dados no período" quando RPC retorna 0 linhas.
- Erro: `toast.error` discreto + mantém último estado conhecido.
- Sem `fetchAllRows`. Sem cálculo agregado no JS — só formatação e ordenação local quando necessário.
- Export Excel preservado (botão no header) — exporta o resultado da aba ativa em XLSX (uma sheet por bloco principal).

## Arquivos

Criados:
- `src/components/analytics/AnalyticsFiltersBar.tsx` — barra de filtros.
- `src/components/analytics/KpiTile.tsx` — card KPI reutilizável (mesmo estilo dos cards atuais).
- `src/components/analytics/EmptyBlock.tsx` — empty state.
- `src/components/analytics/tabs/RevenueTab.tsx`
- `src/components/analytics/tabs/FunnelTab.tsx`
- `src/components/analytics/tabs/PerformanceTab.tsx`
- `src/components/analytics/tabs/ChannelsTab.tsx`
- `src/components/analytics/tabs/QualityTab.tsx`
- `src/components/analytics/tabs/IntelligenceTab.tsx`
- `src/hooks/useAnalyticsFilters.ts` — hook que centraliza estado URL + payload das RPCs.

Editado:
- `src/pages/AnalyticsPage.tsx` — totalmente reescrito como shell de filtros + Tabs.

Não tocado:
- Dashboard, Carteira, Atendimento, Acordos, Financeiro, Relatórios.
- Nenhuma das 16 RPCs `get_bi_*`.
- Nenhuma tabela ou dado.

## Garantias

- Dashboard, Carteira, Atendimento, Acordos, Financeiro: intocados.
- Nenhuma RPC alterada.
- Nenhum dado modificado.
- Padrão visual mantido: paleta laranja primária, cards `rounded-xl border border-border shadow-sm`, mesma tipografia e espaçamento da Analytics atual.
- Cada aba carrega apenas suas RPCs (lazy via `enabled`).
- Conversões nunca exibidas acima de 100%.
- Sem duplicação de métricas operacionais do Dashboard ("acionados hoje", "acordos do dia", "ticket médio do dia" são removidos da Analytics).
