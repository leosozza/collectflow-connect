## Escopo

Apenas ajustes visuais/de clareza na `AnalyticsPage` (desktop). Sem mudar RPCs, cálculos, outras telas ou responsividade mobile.

---

## 1. Renomear abas — `src/pages/AnalyticsPage.tsx`

Trocar apenas os labels visíveis dos `TabsTrigger` (manter `value` interno: `funil`, `performance`, `qualidade`, `inteligencia` — para não quebrar URL state):

- "Funil" → **Funil de Cobrança**
- "Performance" → **Operadores**
- "Qualidade" → **Quebras & Risco**
- "Inteligência" → **Score & Propensão**

Receita e Canais ficam iguais.

---

## 2. Receita — clareza de rótulos — `src/components/analytics/tabs/RevenueTab.tsx`

**Comparativo vs Período Anterior** — mapear `c.metric` (que vem da RPC com nomes técnicos) para PT-BR antes de exibir:

```
total_recebido  → "Recebido"
total_negociado → "Negociado"
total_pendente  → "Pendente"
qtd_acordos     → "Acordos"
ticket_medio    → "Ticket Médio"
```

Implementação: pequeno `METRIC_LABELS` no topo do arquivo + `METRIC_LABELS[c.metric] ?? c.metric` no `<p className="text-xs font-medium capitalize">`. A heurística atual `isMoney = !metric.includes("acordo")` continua válida porque é feita antes do mapeamento.

**KPI "Total Recebido"** — trocar o `hint` de `"${qtd_acordos_ativos} acordos ativos"` para um texto fixo:
- `hint="Valor recebido no período"`
- (a contagem de acordos ativos some desse hint — ela já aparece em outros pontos)

---

## 3. Operadores — unificar as duas tabelas — `src/components/analytics/tabs/PerformanceTab.tsx`

Hoje há duas tabelas redundantes ("Ranking de Operadores" + "Eficiência Operacional"). Unificar em **uma única tabela** chamada **"Ranking de Operadores"**, fazendo merge das duas RPCs por `operator_id`.

Lógica (puro front, sem tocar RPC):
```ts
const merged = (perf.data || []).map((p) => {
  const e = (eff.data || []).find((x) => x.operator_id === p.operator_id) || {};
  return { ...p, ...e };
});
// orden. por total_recebido desc (já vem ordenado de perf)
```

Para operadores que existirem só em `eff` (sem acordos no perf), incluir no final com zeros.

**Colunas finais (nessa ordem):**
| # | Operador | Acordos | Recebido | Chamadas | Taxa de Conversão | Tempo Falado | Taxa de Quebra |

Mapeamento dos campos:
- Acordos → `qtd_acordos`
- Recebido → `total_recebido` (verde, formatCurrency)
- Chamadas → `qtd_chamadas` (eff) com fallback para `qtd_calls` (perf)
- Taxa de Conversão → `conv_rate` %
- Tempo Falado → `talk_time_seconds` formatado HH:MM:SS
- Taxa de Quebra → `taxa_quebra` % (vermelho)

Os 3 KPIs do topo (Operadores Ativos, Talk-Time Total, Acordos/Hora Média) **permanecem iguais**.

A segunda seção "Eficiência Operacional" é **removida** (substituída pela tabela unificada).

---

## 4. Presets de período — `src/components/analytics/AnalyticsFiltersBar.tsx`

Adicionar uma fileira de botões rápidos **antes** dos popovers de calendário (mesma barra), sem remover nada:

- **7 dias** → `setDateFrom(today-6)`, `setDateTo(today)`
- **30 dias** → `today-29` … `today`
- **90 dias** → `today-89` … `today`
- **Mês atual** → `startOfMonth(today)` … `today`

Visual: `Button variant="outline" size="sm" h-8`. Destaque (`variant="default"`) quando o range atual bate exatamente com o preset.

Os calendários manuais e demais filtros continuam intocados.

---

## 5. Empty states contextuais — `src/components/analytics/EmptyBlock.tsx` (uso)

Sem mudar o componente, **passar `message` específica** em cada bloco vazio:

**Operadores (PerformanceTab)** — tabela ranking e KPIs zerados de chamadas:
```
"Sem dados de chamadas no período. Verifique a integração 3CPlus."
```
(usar quando `eff.data` estiver vazio ou `totalTalk === 0` com 0 operadores ativos)

**Score & Propensão (IntelligenceTab)** — Distribuição por Faixa, Score vs Resultado, Top Oportunidades:
```
"Score ainda não calculado para este período."
```

**Demais blocos** (Receita, Funil, Canais, Quebras & Risco) — manter default mas alinhado:
```
"Nenhum dado encontrado com os filtros selecionados."
```
(atualizar o default do `EmptyBlock` para esse texto.)

---

## 6. Score visual — badge colorido — `src/components/analytics/tabs/IntelligenceTab.tsx`

Na tabela **Top Oportunidades**, coluna **Score**, trocar o texto cru `{r.propensity_score}` por um badge inline colorido:

```
0–40   → vermelho   (bg-red-100   text-red-700,   dark variants)
41–70  → amarelo    (bg-amber-100 text-amber-700)
71–100 → verde      (bg-emerald-100 text-emerald-700)
```

Implementação: pequeno helper local `<ScoreBadge value={n} />` (rounded-full, px-2 py-0.5, text-xs font-semibold, tabular-nums). Não reutilizar `PropensityBadge` da Carteira para não arrastar tooltip/ícones que mudam o layout da tabela — manter compacto.

Aplicar o mesmo badge na coluna **Faixa** da tabela "Score vs Resultado" só se o `bucket` vier numérico; se vier string ("0-40", "41-70", "71-100"), apenas colorir o fundo da célula com a faixa correspondente.

---

## 7. Fora do escopo (explicitamente não fazer)

- Mobile/responsividade
- Exportações
- Novos gráficos
- Mudanças em RPCs ou cálculos
- Outras telas
- Mudar `value` interno das tabs (manter URL state estável)

---

## Arquivos tocados

- `src/pages/AnalyticsPage.tsx` — labels das abas
- `src/components/analytics/AnalyticsFiltersBar.tsx` — presets de período
- `src/components/analytics/EmptyBlock.tsx` — texto default
- `src/components/analytics/tabs/RevenueTab.tsx` — METRIC_LABELS + hint
- `src/components/analytics/tabs/PerformanceTab.tsx` — tabela unificada + empty state 3CPlus
- `src/components/analytics/tabs/IntelligenceTab.tsx` — ScoreBadge + empty state score

Sem migrações, sem novas dependências.