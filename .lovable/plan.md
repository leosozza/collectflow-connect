# Correção das RPCs de Funil — `get_bi_collection_funnel` e `get_bi_funnel_dropoff`

## Objetivo

Corrigir o problema em que o estágio "cadastro" usava toda a base histórica de `clients` do tenant, ignorando `_date_from`/`_date_to` e gerando conversões acima de 100% nas etapas seguintes.

Apenas estas duas RPCs serão alteradas via `CREATE OR REPLACE FUNCTION`. Nenhuma outra função, tabela, dado ou tela será tocada.

## Nova definição do funil (mesma assinatura)

Estágios (em ordem):

1. `base_ativa_periodo`
2. `contato_efetivo`
3. `negociacao`
4. `acordo`
5. `pagamento`

Unidade de contagem: **clientes únicos por (CPF, credor)** — evita double-count e mantém coerência com o resto do BI.

Todos os estágios respeitam: `tenant_id`, janela `[_date_from, _date_to]`, `_credor`, `_operator_ids`, `_channel`, `_score_min`, `_score_max`.

### Regras por estágio

- **base_ativa_periodo** — união de CPFs (com credor associado) que tiveram, dentro do período:
  - registro em `call_logs` (via `client_cpf` + `tenant_id`), credor obtido do `clients` mais recente desse CPF/tenant; OU
  - mensagem em `messages` (qualquer direction) ligada a uma `conversations` do tenant, credor obtido via `clients.client_id`; OU
  - linha em `atendimento_sessions` (tem `client_cpf` + `credor` + `tenant_id`); OU
  - linha em `agreements` criada no período (tem `client_cpf` + `credor` + `tenant_id`).
- **contato_efetivo** — subconjunto da base ativa que teve no período:
  - `call_logs.status` indicando atendida/CPC (`answered`, `cpc`, `connected`, `completed`); OU
  - `messages.direction = 'inbound'` em `conversations` do tenant.
- **negociacao** — subconjunto que teve no período:
  - `atendimento_sessions` aberta; OU
  - `agreements` em status `pending`/`pending_approval` criado no período (tentativa de negociação).
- **acordo** — `agreements` criados no período (qualquer status exceto `rejected`).
- **pagamento** — `manual_payments` com `status IN ('confirmed','approved')` cujo `payment_date` está no período, juntando ao `agreements` para obter `tenant_id`/`credor`/`client_cpf` e respeitar filtros.

### Regra anti->100%

Cada estágio é calculado como `INTERSECT` com a `base_ativa_periodo` (em `cadastro_by_credor`/`funnel_dropoff` também por credor). Como todos os estágios subsequentes são subconjuntos da base, `qtd_n ≤ qtd_1`, logo `conversao_pct ≤ 100%`.

`conversao_pct` = `qtd_estagio / qtd_base_ativa_periodo * 100`. Para o estágio 1, `conversao_pct = NULL` (base de referência).

### `get_bi_funnel_dropoff`

Mesma lógica, mas particionada por `credor`. Retorna `credor, stage, qtd, dropoff_pct`, onde `dropoff_pct = (1 - qtd_estagio / qtd_estagio_anterior) * 100` dentro do mesmo credor (clamp em `[0, 100]`).

## Implementação técnica

CTEs em sequência:
1. `params` — normaliza datas (`COALESCE(_date_from, CURRENT_DATE - 30)`, `COALESCE(_date_to, CURRENT_DATE)`).
2. `cpf_credor_calls`, `cpf_credor_msgs`, `cpf_credor_sessions`, `cpf_credor_agreements` — cada um produz `(cpf, credor)` distinct dentro do período + filtros.
3. `base AS (SELECT DISTINCT cpf, credor FROM UNION ALL acima)`.
4. `contato`, `negociacao`, `acordo`, `pagamento` — cada um `INNER JOIN base USING (cpf, credor)` para garantir subconjunto.
5. Saída final via `UNION ALL` em 5 linhas para `collection_funnel`, ou `GROUP BY credor, stage` para `funnel_dropoff`.

Filtros opcionais aplicados em cada CTE de origem:
- `_credor` → `WHERE (_credor IS NULL OR credor = ANY(_credor))`
- `_operator_ids` → aplicado em `call_logs.operator_id`, `agreements.created_by`, `atendimento_sessions.assigned_to`
- `_channel` → aplicado em `conversations.channel_type` e `atendimento_sessions.current_channel`
- `_score_min/_score_max` → join com `clients` (último registro do CPF/credor) e filtro em `propensity_score`

Funções permanecem `STABLE`, `SECURITY DEFINER`, `SET search_path = public`. `GRANT EXECUTE` para `authenticated` é mantido (já existe).

## Validação pós-correção

Executar com `_tenant_id = 39a450f8-7a40-46e5-8bc7-708da5043ec7` (Y.BRASIL), últimos 7 dias, sem demais filtros:

1. `SELECT * FROM get_bi_collection_funnel(...)` — verificar:
   - `qtd` decrescente do estágio 1 ao 5;
   - `conversao_pct ≤ 100` em todos os estágios > 1;
   - `base_ativa_periodo` muito menor que os 130 mil clientes históricos.
2. `SELECT * FROM get_bi_funnel_dropoff(...)` — verificar:
   - `dropoff_pct` entre 0 e 100;
   - sem credores fantasmas.

Relatório copy-paste final com:
- retorno completo de ambas as RPCs;
- comparação com os números antigos (130.566 → ≈ poucas centenas);
- confirmação de que nenhuma conversão > 100%.

## Garantias

- Apenas `CREATE OR REPLACE FUNCTION` em `get_bi_collection_funnel` e `get_bi_funnel_dropoff`.
- Assinatura idêntica (mesmos parâmetros, mesmas colunas de retorno).
- Nenhuma outra RPC, tabela, índice, RLS, edge function ou tela alterada.
- Nenhum dado modificado (apenas SELECT na validação).
- Frontend, AnalyticsPage, Dashboard, Carteira, Atendimento, Acordos: intocados.

## Próximo passo após aprovação

Aplicar migration com as duas funções corrigidas e rodar a bateria de validação read-only no tenant Y.BRASIL.
