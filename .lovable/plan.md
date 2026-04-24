## KPIs de Tendência Reais + Série Diária Comparativa (Total Recebido)

Substituir os placeholders (`+12% vs ontem`, etc.) por valores reais calculados pela RPC, e adicionar uma segunda linha (mês anterior) no gráfico de Total Recebido para comparação dia-a-dia.

---

### 1. Estender RPC `get_dashboard_stats`

Migration que faz `CREATE OR REPLACE` da função, mantendo todas as colunas atuais e adicionando 5 novas colunas comparativas:

| Coluna nova | Tipo | Significado |
|---|---|---|
| `acionados_ontem` | bigint | Acionados de ontem (mesma lógica de `get_acionados_hoje`, deslocada -1 dia) |
| `acordos_dia_anterior` | bigint | Acordos criados ontem (mesmo filtro de `_dia`) |
| `acordos_mes_anterior` | bigint | Acordos criados no mês anterior |
| `total_negociado_mes_anterior` | numeric | `_negociado_mes` calculado para o mês anterior |
| `total_quebra_mes_anterior` | numeric | `_quebra` calculado para o mês anterior |
| `total_pendente_mes_anterior` | numeric | `_pendente` calculado para o mês anterior |
| `total_recebido_mes_anterior` | numeric | `_recebido` calculado para o mês anterior |

Implementação: replicar os blocos de cálculo existentes parametrizando para `_prev_month_start` / `_prev_month_end` e `_yesterday`. A lógica de "Acionados Ontem" é incorporada na própria RPC (consulta a `user_activity_logs` + `agreements` deslocada -1 dia) para evitar nova chamada de rede.

Manter `SECURITY DEFINER`, `search_path=public`, mesma assinatura de parâmetros (compatível).

### 2. Frontend — consumir e calcular % de variação

Arquivo: `src/pages/DashboardPage.tsx`

- Atualizar `interface DashboardStats` com as 7 novas colunas.
- Criar helper `pctDelta(current, previous)`:
  - Retorna `null` se `previous === 0 && current === 0`.
  - Se `previous === 0 && current > 0` → `+100%` positivo.
  - Caso contrário: `((current - previous) / previous) * 100`, formatado como `+12%` / `-8%`.
- Substituir os `trend` hardcoded por valores calculados:
  - **Acionados Hoje**: `pctDelta(acionadosHoje, stats.acionados_ontem)` vs ontem.
  - **Acordos do Dia**: `pctDelta(stats.acordos_dia, stats.acordos_dia_anterior)` vs ontem.
  - **Acordos do Mês**: `pctDelta(stats.acordos_mes, stats.acordos_mes_anterior)` vs mês anterior.
  - **Total Negociado no Mês**: `pctDelta(stats.total_negociado_mes, stats.total_negociado_mes_anterior)`.
  - **Total de Quebra**: `pctDelta(stats.total_quebra, stats.total_quebra_mes_anterior)` — sinal invertido (queda na quebra é positivo).
  - **Pendentes**: `pctDelta(stats.total_pendente, stats.total_pendente_mes_anterior)` — sinal invertido (queda em pendentes é positivo).
- "Colchão de Acordos": permanece sem trend (não há histórico relevante).

### 3. Total Recebido — série diária do mês anterior

Arquivo: `src/components/dashboard/TotalRecebidoCard.tsx`

- Adicionar nova `useQuery` `dashboard-recebido-prev-month-series` que monta um array de `DailyPoint` para o mês anterior usando a mesma lógica (manual_payments + portal_payments), com chave `day-of-month` (1..31).
- Mesclar as duas séries em um único array, indexado por `day` (número do dia do mês), com campos `value` (atual) e `prevValue` (mês anterior). Para dias em que o mês atual ainda não chegou, `value` fica `null` (linha do mês corrente para de desenhar); `prevValue` continua o mês inteiro.
- AreaChart com **duas séries**:
  - Série atual: linha azul `#3b82f6`, gradiente azul (já existente).
  - Série mês anterior: linha cinza `#94a3b8` (slate-400), pontilhada (`strokeDasharray="4 4"`), sem fill, opacity 0.7.
- Tooltip: mostra ambos valores no mesmo dia (`Atual: R$ X | Anterior: R$ Y`).
- Pequena legenda no header: dois pontos coloridos com labels "Atual" e "Mês anterior".
- O total exibido no topo (`totalRecebido`) e o `diffPct` permanecem como estão (já comparam com o mês anterior via `prevMonthTotal`).

### 4. Compatibilidade

- Antes de qualquer migração, a RPC retorna 8 colunas. Após, retorna 15. O frontend lê apenas o primeiro registro e desestrutura por nome → sem quebra de outros consumidores.
- O hook `useScheduledCallbacks` e demais hooks não são tocados.

### 5. Ícone de tendência neutra

- Quando `pctDelta` retorna `null`, exibir traço `—` em `text-muted-foreground` (sem cor de positivo/negativo).

---

### Arquivos editados
- Nova migration: `supabase/migrations/<timestamp>_dashboard_stats_with_deltas.sql`
- `src/pages/DashboardPage.tsx`
- `src/components/dashboard/TotalRecebidoCard.tsx`

### Fora do escopo
- Layout, espaçamentos, identidade visual (mantidos).
- Outros cards (Meta, Agendamentos, Parcelas) — sem alteração.
