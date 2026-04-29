# Plano: Camada de RPCs de BI para Analytics (somente backend)

Criar **uma única migration nova** adicionando 16 funções `SECURITY DEFINER` somente leitura (`STABLE`, apenas `SELECT`) na schema `public`, prefixadas com `get_bi_`. Nenhuma tela, função, tabela, RLS, trigger ou dado existente será tocado. Nenhum código frontend será alterado.

## Princípios

- **Apenas CREATE FUNCTION** novas (com `CREATE OR REPLACE` para idempotência futura, mas sem reusar nomes existentes).
- `SECURITY DEFINER` + `SET search_path = public` (mesmo padrão de `get_agreement_financials`).
- Toda RPC valida `_tenant_id` e força filtro `tenant_id = _tenant_id` em **todas** as fontes.
- `GRANT EXECUTE ... TO authenticated`.
- Sem `INSERT/UPDATE/DELETE`, sem alterações de schema, sem mexer em RLS.
- Filtros opcionais ignorados quando `NULL` (padrão `coalesce`/`OR ... IS NULL`).
- Visão consolidada de credores quando `_credor` é `NULL`; filtragem por 1+ credores quando array é passado.

## Assinatura padrão dos filtros globais

Todas as 16 RPCs aceitam:

```sql
_tenant_id      uuid                 -- obrigatório
_date_from      date    DEFAULT NULL
_date_to        date    DEFAULT NULL
_credor         text[]  DEFAULT NULL
_operator_ids   uuid[]  DEFAULT NULL
_channel        text[]  DEFAULT NULL
_score_min      integer DEFAULT NULL
_score_max      integer DEFAULT NULL
```

Cada função aplica os filtros que fazem sentido para sua fonte (ex.: `_channel` em call_logs/conversations/client_events; `_score_min/_max` em clients.propensity_score).

## Mapeamento fonte → RPC (resumo técnico)

### 1. Receita (prioridade 1)

- **`get_bi_revenue_summary`** — KPIs agregados.
  - Fonte: `agreements` + `manual_payments` (status IN ('confirmed','approved')) + `negociarie_cobrancas` (status pago).
  - Retorna: `total_negociado numeric, total_recebido numeric, total_pendente numeric, total_quebra numeric, ticket_medio numeric, qtd_acordos int, qtd_acordos_ativos int, qtd_quebras int`.
  - Janela por `agreements.created_at` entre `_date_from`/`_date_to`.

- **`get_bi_revenue_by_period`(`_granularity text DEFAULT 'month'`)** — série temporal.
  - Retorna: `period date, total_negociado numeric, total_recebido numeric, qtd_acordos int`.
  - `_granularity` ∈ `'day'|'week'|'month'` via `date_trunc`.

- **`get_bi_revenue_by_credor`** — quebra por credor.
  - Retorna: `credor text, total_negociado numeric, total_recebido numeric, total_pendente numeric, qtd_acordos int, ticket_medio numeric`.

- **`get_bi_revenue_comparison`** — período atual vs período anterior equivalente.
  - Retorna: `metric text, current_value numeric, previous_value numeric, delta_abs numeric, delta_pct numeric`.
  - Métricas: `recebido`, `negociado`, `qtd_acordos`, `ticket_medio`.

### 2. Qualidade / Quebra (prioridade 2)

- **`get_bi_breakage_analysis`** — visão geral de quebras.
  - Fonte: `agreements WHERE status='cancelled' OR cancellation_type IS NOT NULL`.
  - Retorna: `qtd_total int, qtd_quebra int, taxa_quebra numeric, valor_perdido numeric, motivo text, qtd_motivo int` (agrupado por `cancellation_type`).

- **`get_bi_breakage_by_operator`** — quebra por operador.
  - Join `agreements.created_by → profiles.user_id`.
  - Retorna: `operator_id uuid, operator_name text, qtd_acordos int, qtd_quebras int, taxa_quebra numeric, valor_perdido numeric`.

- **`get_bi_recurrence_analysis`** — recorrência de devedores.
  - Fonte: `agreements` agrupado por `client_cpf` + `tenant_id`.
  - Retorna: `cpf_distintos int, devedores_recorrentes int, taxa_recorrencia numeric, top_cpfs jsonb` (cpf, nome, qtd_acordos, total_negociado — top 20).

### 3. Funil (prioridade 3)

- **`get_bi_collection_funnel`** — funil cadastro → contato → negociação → acordo → pagamento.
  - Etapas:
    1. `clients` distintos por CPF (universo)
    2. clientes com `client_events` (contato qualquer canal)
    3. clientes com `atendimento_sessions` (negociação iniciada)
    4. CPFs com `agreements` no período
    5. CPFs com `manual_payments`/`negociarie_cobrancas` pagos
  - Retorna: `stage text, stage_order int, qtd int, conversao_pct numeric` (vs etapa anterior).

- **`get_bi_funnel_dropoff`** — drop-off agrupado por credor.
  - Retorna: `credor text, stage text, qtd int, dropoff_pct numeric`.

### 4. Performance (prioridade 4)

- **`get_bi_operator_performance`** — ranking de operadores.
  - Fontes: `agreements.created_by`, `call_logs.operator_id` (cast para uuid quando válido), `call_dispositions.operator_id`.
  - Retorna: `operator_id uuid, operator_name text, qtd_acordos int, total_recebido numeric, qtd_calls int, qtd_cpc int, taxa_cpc numeric, qtd_quebras int, taxa_quebra numeric`.

- **`get_bi_operator_efficiency`** — eficiência (acordo / hora ativa, talk time, conv rate).
  - Retorna: `operator_id uuid, operator_name text, talk_time_seconds bigint, qtd_chamadas int, qtd_conversoes int, conv_rate numeric, acordos_por_hora numeric`.
  - "Conversão" = `call_dispositions` cujo `disposition_type` está em `call_disposition_types.is_conversion = true`.

### 5. Canais (prioridade 5)

- **`get_bi_channel_performance`** — performance por canal.
  - Fonte: `client_events.event_channel` ∪ `call_logs` (canal `voice`) ∪ `conversations.channel_type` ∪ `chat_messages.provider`.
  - Retorna: `channel text, qtd_interacoes int, qtd_clientes_unicos int, qtd_acordos_atribuidos int, taxa_conversao numeric, total_recebido_atribuido numeric`.
  - Atribuição: último canal de `client_events` antes do `agreement.created_at` para o mesmo CPF.

- **`get_bi_response_time_by_channel`** — tempo médio de resposta.
  - Fonte: `chat_messages` agrupado por `conversation_id` calculando o intervalo `inbound → próxima outbound`.
  - Retorna: `channel text, avg_response_seconds numeric, p50_seconds numeric, p90_seconds numeric, qtd_amostras int`.

### 6. Score / Inteligência (prioridade 6)

- **`get_bi_score_distribution`** — distribuição em buckets.
  - Fonte: `clients.propensity_score`.
  - Buckets: `0-20`, `21-40`, `41-60`, `61-80`, `81-100`, `null`.
  - Retorna: `bucket text, qtd int, pct numeric, valor_carteira numeric`.

- **`get_bi_score_vs_result`** — score vs resultado real.
  - Junta `clients.propensity_score` com presença de `agreements` e `manual_payments`/`negociarie_cobrancas` pagos.
  - Retorna: `bucket text, qtd_clientes int, qtd_com_acordo int, taxa_acordo numeric, qtd_pagos int, taxa_pagamento numeric, valor_recebido numeric`.

- **`get_bi_top_opportunities`(`_limit int DEFAULT 50`)** — top oportunidades.
  - Critério: `clients` sem `agreements` ativos, ordenados por `propensity_score DESC`, `valor_atualizado DESC`.
  - Retorna: `client_id uuid, cpf text, nome text, credor text, propensity_score int, valor_atualizado numeric, debtor_profile text, preferred_channel text, ultimo_contato timestamptz`.

## Estrutura técnica das funções

Padrão (exemplo abreviado):

```sql
CREATE OR REPLACE FUNCTION public.get_bi_revenue_summary(
  _tenant_id    uuid,
  _date_from    date    DEFAULT NULL,
  _date_to      date    DEFAULT NULL,
  _credor       text[]  DEFAULT NULL,
  _operator_ids uuid[]  DEFAULT NULL,
  _channel      text[]  DEFAULT NULL,
  _score_min    integer DEFAULT NULL,
  _score_max    integer DEFAULT NULL
)
RETURNS TABLE (
  total_negociado    numeric,
  total_recebido     numeric,
  total_pendente     numeric,
  total_quebra       numeric,
  ticket_medio       numeric,
  qtd_acordos        integer,
  qtd_acordos_ativos integer,
  qtd_quebras        integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT a.*
    FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND (_date_from IS NULL OR a.created_at::date >= _date_from)
      AND (_date_to   IS NULL OR a.created_at::date <= _date_to)
      AND (_credor       IS NULL OR a.credor      = ANY(_credor))
      AND (_operator_ids IS NULL OR a.created_by  = ANY(_operator_ids))
  ),
  pagos AS (
    SELECT mp.agreement_id, SUM(mp.amount_paid) AS pago
    FROM manual_payments mp
    WHERE mp.tenant_id = _tenant_id
      AND mp.status IN ('confirmed','approved')
    GROUP BY mp.agreement_id
  )
  SELECT
    COALESCE(SUM(b.proposed_total),0),
    COALESCE(SUM(p.pago),0),
    GREATEST(COALESCE(SUM(b.proposed_total),0) - COALESCE(SUM(p.pago),0), 0),
    COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status='cancelled'),0),
    CASE WHEN COUNT(*) FILTER (WHERE b.status<>'cancelled')>0
         THEN COALESCE(SUM(b.proposed_total) FILTER (WHERE b.status<>'cancelled'),0)
              / COUNT(*) FILTER (WHERE b.status<>'cancelled')
         ELSE 0 END,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE b.status<>'cancelled')::int,
    COUNT(*) FILTER (WHERE b.status='cancelled')::int
  FROM base b
  LEFT JOIN pagos p ON p.agreement_id = b.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_bi_revenue_summary(uuid,date,date,text[],uuid[],text[],integer,integer) TO authenticated;
```

As demais 15 RPCs seguem o mesmo padrão (CTE → filtros opcionais → agregação no banco → `GRANT EXECUTE ... TO authenticated`).

## Garantias

- Não altera `get_agreement_financials`, `get_carteira_grouped`, `get_my_tenant_id`, nem qualquer função existente.
- Não altera políticas RLS — `SECURITY DEFINER` lê tabelas com filtro explícito de `tenant_id = _tenant_id`.
- Não cria índices nem mexe em tabelas (se desempenho for um problema futuro, será tratado em migration separada).
- Frontend continua intocado: nenhum arquivo `.tsx`/`.ts` será modificado.

## Entregáveis ao final

1. Uma migration nova em `supabase/migrations/<timestamp>_bi_analytics_rpcs.sql` com as 16 funções + GRANTs.
2. Lista das funções criadas + um exemplo `SELECT` de chamada para cada uma (no corpo da resposta), por exemplo:
   ```sql
   SELECT * FROM public.get_bi_revenue_summary('<tenant_uuid>', '2026-01-01', '2026-04-30');
   SELECT * FROM public.get_bi_collection_funnel('<tenant_uuid>', NULL, NULL, ARRAY['CredorX']);
   SELECT * FROM public.get_bi_top_opportunities('<tenant_uuid>', NULL, NULL, NULL, NULL, NULL, 60, 100, 50);
   ```
3. Confirmação de que `supabase--linter` não acusou novas issues e nenhum arquivo de aplicação foi tocado.

Após aprovação deste plano, executo a migration e devolvo a lista final + exemplos de teste.
