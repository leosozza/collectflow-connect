## Objetivo
1. Trocar a comparação "vs mês anterior" de **mês inteiro** para **MTD proporcional** (mesmo intervalo de dias do mês passado), eliminando os falsos -70% no início do mês.
2. Repaginar o `KpisGridCard` para tornar o número o "herói" do card e a variação % discreta.
3. Manter governança: tenant_id, Regra 7 (metas), props obrigatórias.

---

## 1. MTD proporcional na RPC `get_dashboard_stats`

A RPC já existe (a v2 ainda não está deployada — o front faz fallback). A correção será feita via **migration** alterando apenas as janelas do mês anterior, sem mexer em lógica de tenant nem de filtros de operador.

Hoje:
```text
_prev_month_start = primeiro dia do mês anterior
_prev_month_end   = último dia do mês anterior
```

Depois (apenas quando o mês alvo for o mês corrente):
```text
_is_current_month = (_target_year, _target_month) == (mês atual)
_day_cutoff       = EXTRACT(DAY FROM CURRENT_DATE)
_prev_month_start = primeiro dia do mês anterior
_prev_month_end   = LEAST(_prev_month_start + (_day_cutoff - 1), último dia do mês anterior)
                    -- só quando _is_current_month for true
```

Quando o usuário filtra um mês passado fechado (ex.: Março), mantemos a janela do mês anterior cheia (sem corte), porque comparar "Março inteiro" com "Fevereiro até dia 8" não faz sentido.

Campos afetados pelo corte (já são os pedidos):
- `total_recebido_mes_anterior` (manual_payments / portal_payments / negociarie_cobrancas)
- `acordos_mes_anterior` (count em agreements)
- `total_quebra_mes_anterior` (UNION ALL de parcelas)
- `total_pendente_mes_anterior` (UNION ALL de parcelas)
- `total_negociado_mes_anterior` (consistência, mesmo não exibido como trend hoje)

Demais blocos (mês corrente, projetado, acionados_ontem, acordos_dia/dia_anterior) ficam intactos.

Risco: zero — alteração circunscrita às variáveis `_prev_month_start/_prev_month_end` e ao gate `_is_current_month`. Multi-tenant e filtros de operador permanecem idênticos.

## 2. Tooltip / contexto no front

`src/pages/DashboardPage.tsx` já calcula trends via `pctDelta`. Nada muda na chamada — só os valores `*_mes_anterior` virão proporcionais. Vou apenas atualizar o texto de trend de "vs mês anterior" para **"vs mesmo período"** quando estamos no mês corrente, para refletir o que o número significa. (Texto puro, sem alterar lógica.)

## 3. UI premium em `KpisGridCard.tsx`

Mudanças apenas de classes Tailwind (presentation):

- Valor principal: `text-[15px] font-semibold` → `text-2xl font-bold tracking-tight` (com `text-xl` em telas muito apertadas via `lg:text-2xl`).
- Label: mantém `text-[10.5px] text-muted-foreground/90`, mas movido para **acima** do valor com menor proeminência.
- Ícone: continua no topo, um pouco menor para dar espaço ao número.
- Trend: `text-[9.5px]` → `text-[10px]`, cor da variação em `text-emerald-600/80` e `text-red-500/80` (mais suaves), texto auxiliar em `text-muted-foreground/60`.
- Reorganização do flex interno para que o **número fique opticamente centralizado** e seja o primeiro elemento que o olho captura.

Sem mudanças de layout do grid (continua 3×2), sem mudanças de props, sem novos imports.

## 4. Governança

- Regra 1 (multi-tenant): preservada — RPC continua resolvendo `_tenant` via `tenant_users` e todos os filtros `tenant_id = _tenant` ficam intactos.
- Regra 7 (metas): nada do fluxo de metas é tocado.
- `DashboardMetaCard` continua recebendo `tenantId={effectiveTenantId}`. Nenhuma prop crítica é removida.
- Nenhuma alteração em RLS, edge functions ou schemas.

## Arquivos afetados
- **migration SQL** — `CREATE OR REPLACE FUNCTION public.get_dashboard_stats(...)` com a nova janela MTD proporcional
- `src/pages/DashboardPage.tsx` — apenas o texto `"vs mês anterior"` → `"vs mesmo período"` no trend (4 ocorrências)
- `src/components/dashboard/KpisGridCard.tsx` — tipografia/hierarquia do `Tile`

## Validação
- Após migration: rodar a RPC com `_year/_month` = mês atual e conferir que `*_mes_anterior` reflete só até o dia equivalente.
- Visual: conferir cards no preview com viewport atual (1678×1108) e em `lg`.
