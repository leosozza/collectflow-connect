## Auditoria do módulo Gamificação

Mapeei tudo: regras de pontuação, snapshot, ranking, campanhas, conquistas, metas, RivoCoins, RLS e cron. Abaixo os **9 pontos frágeis** encontrados — em ordem de criticidade — e o que vou corrigir.

---

### 🔴 CRÍTICO 1 — Novos tenants não recebem regras de pontuação

`onboard_tenant` cria tenant + módulos + tokens, mas **não chama** `seed_default_scoring_rules`. Não existe trigger `AFTER INSERT ON tenants` ligado à função.

**Resultado**: novo tenant abre Gamificação → tabela `gamification_scoring_rules` vazia → RPC de snapshot calcula `_w_payment=0, _w_total_received=0, …` → **todo mundo zero pontos eternamente**.

**Fix**: criar trigger `AFTER INSERT ON tenants EXECUTE seed_default_scoring_rules()` + backfill para tenants existentes sem regras.

---

### 🔴 CRÍTICO 2 — Novos tenants não recebem templates de conquistas

Mesma falha: nenhum `achievement_templates` é semeado. Tenant novo nunca desbloqueia nada (loop em `useGamification.ts` itera array vazio).

**Fix**: criar função `seed_default_achievement_templates(tenant_id)` com pacote padrão (Primeira Negociação, 10 Pagamentos, Meta Batida, Sem Quebras, R$ 10k, R$ 50k) e chamar dentro do `onboard_tenant` + via trigger + backfill.

---

### 🔴 CRÍTICO 3 — Snapshot e Trigger usam fontes diferentes de "valor recebido"

- **`recalculate_operator_gamification_snapshot`** (server, fonte do Ranking): soma só `manual_payments` + `negociarie_cobrancas`.
- **`useGamificationTrigger.ts`** (client, achievements/meta): chama `get_operator_received_total` que soma **3 fontes** (manual + negociarie + **portal_payments**).
- **`get_agreement_financials`** (Dashboard/Analytics): outra variante.

**Resultado**: operador com pagamento via Portal tem meta batida no toast, mas o `total_received` salvo em `operator_points` ignora portal → ranking errado, conversão de RivoCoins errada.

**Fix**: refatorar `recalculate_operator_gamification_snapshot` para chamar **`get_operator_received_total`** internamente (SSoT única). Fim da divergência.

---

### 🔴 CRÍTICO 4 — `payments_count` calculado de forma inconsistente

- Snapshot RPC: `manual_count + neg_count` (parcelas + negociarie pagas).
- Trigger client (achievement `payments_count`): conta `clients.data_quitacao` no mês (= dívidas quitadas, não parcelas).
- Achievements então disparam com base num número que NUNCA é o mesmo do ranking.

**Fix**: padronizar — `payments_count` em ambos os lugares = parcelas confirmadas (manual + portal + negociarie). Atualizar `useGamificationTrigger` para ler o resultado do RPC em vez de recalcular.

---

### 🟠 ALTO 5 — Campanhas: `negociado_e_recebido`, `default` e fallbacks usam `clients.valor_pago`

No `campaignService.ts` e `useGamificationTrigger.ts`:
```ts
.from("clients").select("valor_pago").gte("data_quitacao", ...)
```
Isso só conta dívidas **totalmente quitadas** — ignora parcelas pagas e Negociarie. Mesmo bug que você acabou de corrigir no snapshot, ainda vivo nas campanhas.

**Fix**: criar RPC `get_operator_negotiated_and_received(_user_id, _start, _end, _credor_names)` server-side que reusa a lógica unificada e refatorar o switch no client para chamar RPCs (eliminar queries fragmentadas).

---

### 🟠 ALTO 6 — Trigger client é frágil para multi-tenant

`useGamificationTrigger`:
- Roda no `useEffect` da página → só atualiza quando o operador **abre** Gamificação. Operador que nunca entra fica congelado.
- Faz 6+ queries client-side (vulnerável a RLS / latência).
- Para campanhas: faz UPDATE em loop por campanha (N+1). Tenant com 10 campanhas ativas = 10×6 queries.

**Fix**: criar RPC server-side `recalculate_operator_full(_profile_id, _year, _month)` que faz tudo (snapshot + campanhas ativas + meta + conquistas) em uma única transação. Client chama 1 RPC.

Bonus: agendar cron `*/30 * * * *` para recalcular tenant inteiro, garantindo independência de quem abre a tela.

---

### 🟠 ALTO 7 — Conversão mensal de pontos → RivoCoins não filtra por tenant

`convert_monthly_points_to_rivocoins(year, month)` itera **TODAS as linhas** de `operator_points` do mês (todos os tenants). Funciona hoje porque só há 1 tenant, mas:
- Se um tenant for desativado, ainda recebe RivoCoins.
- Não há ponto único de "ligar/desligar" gamificação por tenant.

**Fix**: filtrar por `tenants.status='active'` e por tenants com módulo `gamificacao` habilitado.

---

### 🟡 MÉDIO 8 — `close_campaign_and_award_points` premia operadores sem score real

Hoje pega `LIMIT 3 ORDER BY score DESC`, sem checar se `score > 0`. Em campanha sem participantes ativos, premia 3 zeros.

**Fix**: adicionar `WHERE score > 0` e logar vencedores em `audit_logs`.

---

### 🟡 MÉDIO 9 — `unit_size` da regra `total_received` permite divisão por zero / valores absurdos

UI permite admin salvar `unit_size = 0` ou negativo. RPC tem fallback `IF _u <= 0 THEN 100`, mas UI não bloqueia. Também não há validação de `points` (pode salvar 999999).

**Fix**: validação no `scoringRulesService.updateScoringRule` (clamps: `unit_size ≥ 1`, `points entre -1000 e 1000`) + `CHECK constraint` na coluna.

---

## O que vou implementar (1 migração + 4 arquivos TS)

### Migração SQL
1. **Trigger** `AFTER INSERT ON tenants` → executa `seed_default_scoring_rules` + nova `seed_default_achievement_templates`.
2. **Backfill**: rodar seeds para todos os tenants existentes que estão sem regras/templates.
3. **Refatoração** de `recalculate_operator_gamification_snapshot` para usar `get_operator_received_total` (SSoT).
4. **Nova RPC** `recalculate_operator_full(_profile_id, _year, _month)` agregando snapshot + campanhas + meta.
5. **Nova RPC** `get_operator_negotiated_and_received(...)` para campanha tipo `negociado_e_recebido`.
6. **Hardening** de `convert_monthly_points_to_rivocoins` (filtro tenant ativo + módulo habilitado).
7. **Hardening** de `close_campaign_and_award_points` (score > 0).
8. **CHECK constraints** em `gamification_scoring_rules` (`unit_size > 0`, `points BETWEEN -1000 AND 1000`).
9. **Re-executar** snapshot de Abr/2026 com a nova lógica unificada e mostrar tabela de auditoria.

### Frontend
- `useGamificationTrigger.ts`: simplificar — chamar `recalculate_operator_full` e remover lógica duplicada de campanha/meta.
- `campaignService.ts` (`computeCampaignScore`): trocar queries fragmentadas por RPCs unificadas.
- `scoringRulesService.ts` (`updateScoringRule`): clamps client-side.
- `ScoringRulesTab.tsx`: bloquear input inválido (já existe min/max básico — reforçar).

### Validação final
Recalculo de Abril/2026 e tabela comparativa: `total_received antigo vs novo` + `pontos antigos vs novos` para os 4 operadores. Esperado: Vitor passar de R$ 37.885 → ainda 37.885 (já bate) **mais portal_payments se houver**, e mesmo número validado no Dashboard/Analytics.

## Observação

Não vou tocar em UI visual (ranking cards, tabs, badges) — só na lógica e infra. A interface continua igual, mas passa a refletir números corretos para qualquer tenant novo, sem precisar de configuração manual.

Posso prosseguir?
