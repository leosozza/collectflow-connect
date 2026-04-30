## FASE 0 — Auditoria (já concluída em modo leitura)

Mapeamento das RPCs consumidas pelo Analytics e dos seus filtros:

| RPC | Aba | Fonte de data | Filtro tenant | Filtro operador | Filtro credor | Filtro canal | Dedup |
|---|---|---|---|---|---|---|---|
| get_bi_revenue_summary / by_period / by_credor / comparison | Receita | data efetiva pgto (mp.payment_date, pp.updated_at, nc.data_pagamento) | OK | OK (a.created_by) | OK | — | por agreement_id |
| get_bi_collection_funnel / funnel_dropoff | Funil | call_logs.called_at, chat_messages.created_at, sessions.opened_at, agreements.created_at, manual_payments.payment_date | OK | parcial (só agreements e dispositions têm operator) | OK | implícito | por (cpf, credor) |
| get_bi_operator_performance | Operadores | a.created_at, cl.called_at, cd.created_at | OK | OK | OK | — | join por op |
| get_bi_operator_efficiency | Operadores | cl.called_at, cd.created_at, a.created_at | OK | OK (no agreements) | OK | — | join por op |
| **get_bi_channel_performance** | **Canais** | ce.created_at, a.created_at, mp/pp/nc por data efetiva | OK | OK (no agreements) | OK | OK (mas usa nomes errados) | por agreement_id |
| get_bi_response_time_by_channel | Canais | chat_messages.created_at | OK | — | — | OK | — |
| get_bi_breakage_analysis / by_operator | Quebras | **a.created_at (errado — deveria ser data da quebra)** | OK | OK | OK | — | — |
| get_bi_recurrence_analysis | Quebras | a.created_at | OK | OK | OK | — | por client_cpf |
| get_bi_score_distribution / score_vs_result | Score | clients.created_at (DISTINCT ON cpf,credor) | OK | OK (no agreements) | OK | — | por (cpf, credor) |
| get_bi_top_opportunities | Score | clients | OK | — | OK | — | por (cpf, credor) |

**Conclusões da auditoria:**
1. Todas respeitam `tenant_id`. Sem mistura entre tenants.
2. Receita já está correta (3 fontes por data efetiva). **Não será tocada.**
3. **Canais (`get_bi_channel_performance`)** usa `client_events.event_channel` aberto. Hoje aparece `boleto` (payment_confirmed/agreement_completed) e o ruído de `debtor_profile_changed` cai em `whatsapp`. Eventos `whatsapp_outbound`/`message_sent` inflam interações com automações.
4. **Operadores** mostra "Desconhecido" mesmo com tudo zero, e calcula `acordos_por_hora=0.00` quando não há talk-time.
5. **Score**: chart inclui `sem_score` na mesma série, esmagando as faixas.
6. **Quebras**: `get_bi_breakage_analysis` filtra por `created_at` do acordo (data de criação), não pela data efetiva da quebra.
7. **Filtro de canal (UI)**: opções `voice`, `email`, `sms`, `portal` não existem em `client_events.event_channel` (DB tem `whatsapp`, `call`, `boleto`, NULL). `voice` jamais matcha.

---

## FASE 1 — Canais (alvo principal)

**Migration nova** (não desfaz nada da Receita):

1. Recriar `get_bi_channel_performance` com:
   - **Allowlist de event_type de comunicação**:
     - WhatsApp: `whatsapp_inbound`, `whatsapp_outbound`, `message_sent`, `message_deleted`, `atendimento_opened`, `conversation_auto_closed`
     - Voz: `disposition`, `call_hangup` (canal `call`)
   - **Bloqueia explicitamente** `debtor_profile_changed`, `payment_confirmed`, `agreement_*`, `manual_payment_*`, `field_update`, `installment_value_synced`, `phone_*`, `document_*`, `observation_added` mesmo se tiverem `event_channel`.
   - **Normalização de canal** num CASE:
     - `whatsapp`/`wpp`/`WhatsApp` → `whatsapp` (label "WhatsApp")
     - `call`/`voice`/`ligacao` → `voice` (label "Ligação")
     - demais (`boleto`, `pix`, `manual`, `negociarie`, `payment`, `system`, `unknown`, NULL) → descartados
   - Filtro `_channel` aplica sobre canal já normalizado.
   - Atribuição de pagamento ao canal continua: último canal (whatsapp/voice) **antes** de `a.created_at`. Recebido continua somando as 3 fontes (preserva Receita).

2. Atualizar `CHANNEL_OPTIONS` em `AnalyticsFiltersBar.tsx` para usar os mesmos identificadores normalizados que o backend retorna:
   - `whatsapp` → "WhatsApp"
   - `voice` → "Ligação"
   - (remover `email`, `sms`, `portal` — não são canais reais hoje)
3. Atualizar `channelLabel` em `ChannelsTab.tsx` para refletir os 2 canais reais.
4. `get_bi_response_time_by_channel`: já usa `chat_messages` (apenas WhatsApp). Não muda comportamento, só deixa retornar rótulo `whatsapp` consistente.

**Validação**: tenant Y.BRASIL abril/2026 — `boleto` não aparece; `debtor_profile_changed` não infla WhatsApp; recebido por canal somado bate ≈ R$ 95.705,33 (mais o que não tem canal real — esse fica fora porque Canais é por canal real).

---

## FASE 2 — Operadores

**Front (`PerformanceTab.tsx`)**:
1. Filtrar do `merged` qualquer linha onde **todos** os indicadores sejam zero (`qtd_acordos=0`, `total_recebido=0`, `qtd_chamadas=0`, `qtd_quebras=0`, `talk_time=0`).
2. Linhas com dados reais sem profile vinculado: renomear `Desconhecido` → `Operador não vinculado` (somente quando há atividade).
3. KPI "Operadores Ativos": contar apenas operadores com atividade real (mesma regra do filtro acima).
4. Quando `totalTalk === 0` para todos: exibir "—" em vez de `0.00` para "Acordos/Hora (Média)" e mostrar legenda "sem base de chamadas no período".
5. Coluna "Tempo Falado" e "Chamadas" continuam mostrando 0 quando não há dados (esperado), mas a coluna "Taxa de Conversão" / "Acordos/Hora" só preenche quando há base.

**Backend**: nenhuma alteração em `get_bi_operator_performance`/`efficiency` — todos os totais e atribuições continuam iguais (preserva Receita por operador).

---

## FASE 3 — Score & Propensão

**Front (`IntelligenceTab.tsx`)**:
1. Separar `sem_score` do array antes de plotar.
2. `BarChart` exibe somente as 5 faixas numéricas (`0-20`, `21-40`, `41-60`, `61-80`, `81-100`), em ordem fixa.
3. Acima do gráfico, adicionar um KPI tile pequeno "Clientes sem score" com qtd e %.
4. Tabela "Score vs Resultado": separar `sem_score` numa linha visualmente distinta (background levemente cinza, divider acima), depois das faixas numéricas.

**Backend**: nenhuma alteração em `get_bi_score_distribution` / `get_bi_score_vs_result`. Não recalcula score, não toca em perfis.

---

## FASE 4 — Quebras & Risco

**Migration nova** — recriar `get_bi_breakage_analysis` e `get_bi_breakage_by_operator`:

1. Como não existe `cancelled_at`, filtrar por `a.updated_at::date` **somente quando** `a.status = 'cancelled'` (data efetiva da quebra ≈ updated_at do registro cancelado).
2. Manter `WHERE a.status='cancelled'` (não conta `approved`/`pending`/`completed`/`overdue`).
3. `get_bi_recurrence_analysis`: normalizar CPF com `regexp_replace(client_cpf,'\D','','g')` antes de agrupar.
4. `valor_perdido`: continuar com `proposed_total` do acordo cancelado — consistente; documentar no SQL.

**Validação**: filtro de período passa a refletir quando o acordo foi efetivamente quebrado (não quando foi criado).

---

## FASE 5 — Segurança e tenant

1. No frontend `AnalyticsPage.tsx`: quando `profile.role !== 'admin'`, **forçar** `_operator_ids = [profile.user_id]` no `rpcParams` (override sobre o que o filtro selecionar). Usuário comum só vê os próprios números.
2. Nas migrations das RPCs alteradas (Fase 1 e 4), adicionar guard no início:
   ```sql
   IF _tenant_id IS NULL OR NOT EXISTS (
     SELECT 1 FROM public.tenant_users tu
     WHERE tu.tenant_id = _tenant_id AND tu.user_id = auth.uid()
   ) AND NOT public.is_super_admin(auth.uid())
   THEN RAISE EXCEPTION 'forbidden tenant'; END IF;
   ```
   (usar a função existente de super admin se houver; caso contrário, só checar `tenant_users`).
3. Não alterar grants das RPCs de Receita / Funil / Score / Operadores nesta fase para evitar regressão. Se o tempo permitir, apenas as 3 RPCs tocadas (channel_performance, breakage_analysis, breakage_by_operator) recebem o guard como modelo; demais RPCs ficam como follow-up documentado.

---

## FASE 6 — QA final

Rodar com tenant Y.BRASIL, abril/2026:
- [ ] Receita / Total Recebido = R$ 95.705,33 (dashboard e Analytics).
- [ ] Aba Canais sem `boleto`/`pix`/`manual`/`negociarie`. Apenas WhatsApp e Ligação.
- [ ] `debtor_profile_changed` não inflando interações.
- [ ] Operadores: sem linhas zeradas "Desconhecido". `Acordos/Hora` mostra "—" se não houver talk-time.
- [ ] Score: chart legível, `sem_score` em KPI separado.
- [ ] Quebras: período usando `updated_at` em registros cancelados.
- [ ] Filtros (período, credor, operador, canal, score) funcionando combinados.
- [ ] Build/typecheck/lint OK.
- [ ] Operador comum só vê os próprios números.

---

## Arquivos a alterar

**Migrations novas (2)**:
- `supabase/migrations/<ts>_bi_channel_perf_allowlist.sql` — recria `get_bi_channel_performance` com allowlist e normalização + guard de tenant.
- `supabase/migrations/<ts>_bi_breakage_dates.sql` — recria `get_bi_breakage_analysis`, `get_bi_breakage_by_operator`, `get_bi_recurrence_analysis` com data efetiva da quebra e CPF normalizado + guard.

**Frontend (4)**:
- `src/components/analytics/AnalyticsFiltersBar.tsx` — `CHANNEL_OPTIONS` reduzido a `whatsapp` + `voice`.
- `src/components/analytics/tabs/ChannelsTab.tsx` — `channelLabel` ajustado.
- `src/components/analytics/tabs/PerformanceTab.tsx` — filtro de linhas zeradas, rename "Operador não vinculado", "—" em Acordos/Hora sem base.
- `src/components/analytics/tabs/IntelligenceTab.tsx` — chart só com faixas numéricas, KPI separado para `sem_score`, separador na tabela.
- `src/pages/AnalyticsPage.tsx` — força `_operator_ids = [profile.user_id]` para operadores não-admin.

**Não tocar**:
- Receita (RPCs e tab) — já validado.
- Dashboard, Financeiro, Acordos, Baixas, WhatsApp/chat/ingest_channel_event, Discador, Super Admin.
- `client_events`, `manual_payments`, `portal_payments`, `negociarie_cobrancas`.
- Score: lógica/cálculo. Apenas apresentação.

---

## Riscos residuais

- Atribuição de canal a um pagamento depende de existir um evento `whatsapp_*` ou `disposition`/`call_hangup` antes de `a.created_at`. Acordos sem nenhum contato registrado terão `channel = NULL` e ficam fora da aba Canais (mas continuam contando na Receita). É o comportamento correto.
- `get_bi_breakage_analysis` passa a usar `updated_at`. Se houve uma alteração no registro depois do cancelamento (raro), a data sai um pouco diferente da quebra real — é a melhor aproximação enquanto não houver coluna dedicada `cancelled_at`. Documentado.
- Outras RPCs (revenue, funnel, score, operator perf/eff) continuam sem guard explícito de tenant nesta correção, dependendo da `auth.uid()` ser usada via filtro client-side. Recomenda-se hardening em uma fase posterior dedicada (fora deste escopo).
