## Fase final do hardening de Gamificação

Os 3 itens pendentes do plano anterior. Sem mudanças de UI.

---

### 1. Nova RPC `recalculate_operator_full(_profile_id, _year, _month)`

Função `SECURITY DEFINER` que executa em **uma única transação**:
1. `recalculate_operator_gamification_snapshot` (snapshot mensal — fonte do ranking).
2. Itera **campanhas ativas** do tenant em que o operador participa, calcula score via SSoT (`get_operator_received_total` / `get_operator_negotiated_and_received` conforme métrica) e faz UPDATE em `campaign_participants`.
3. Reavalia meta mensal (`monthly_goals` + `awardGoalIfReached` lógica) — se batida e ainda não premiada, insere achievement e soma pontos da meta.
4. Concede achievements baseados em templates do tenant (passa a usar contagem do snapshot — SSoT — em vez de recalcular `payments_count` no client).

Retorna `jsonb` com `{ snapshot, campaigns_updated, goal_awarded, achievements_granted }` para debug.

Versão `recalculate_my_full(_year,_month)` que faz `auth.uid()` → `profile_id` (paralelo a `recalculate_my_gamification_snapshot`).

---

### 2. Refatoração `useGamificationTrigger.ts`

Substitui as 6+ queries client-side por **1 chamada**:
```ts
await supabase.rpc("recalculate_my_full", { _year, _month });
```
Remove: contagem de `clients`, contagem de `agreements`, contagem de `breaks`, loop de campanhas, `awardGoalIfReached`, `checkAndGrantAchievements` client-side. Tudo passa para o servidor.

Mantém apenas: leitura do resultado para exibir toast de "meta batida" / "novo achievement" se o JSON retornar isso.

Bônus: `useGamification.checkAndGrantAchievements` (client) é mantido apenas para retrocompatibilidade mas marcado como `@deprecated`.

---

### 3. Refatoração `campaignService.computeCampaignScore`

Remove queries fragmentadas em `agreements` + `clients`. Passa a chamar:
- `maior_valor_recebido` → `get_operator_received_total` (já está).
- `negociado_e_recebido` → **`get_operator_negotiated_and_received`** (já criado, mas não usado).
- `default` → mesmo RPC unificada.

Métricas restantes (`maior_qtd_acordos`, `menor_taxa_quebra`, `menor_valor_quebra`, `maior_valor_promessas`) continuam em `agreements` (são contagens/somas estruturais — não envolvem pagamento).

Mesma refatoração espelhada em `useGamificationTrigger.ts → calculateCampaignScore`. (Idealmente este código será removido pelo passo 2; mantido apenas como fallback.)

---

### 4. Cron `*/30 * * * *` — recálculo automático

Cria job pg_cron que chama edge function `gamification-recalc-tick` (nova). A edge:
1. Lista tenants ativos com módulo `gamificacao` habilitado.
2. Para cada tenant, lista operadores com `enabled=true` em `gamification_participants`.
3. Chama `recalculate_operator_full(profile_id, current_year, current_month)` para cada um.
4. Loga resumo em `audit_logs` (`category='gamification', action='auto_recalc_tick'`).

Garante que ranking, meta e campanhas continuem corretos mesmo para operadores que **não abrem** a tela de Gamificação (fix do CRÍTICO 6).

A edge usa autenticação dual (service_role + JWT) seguindo o padrão `tech/edge-functions/production-hardening`.

---

### Arquivos

**Migração SQL** (1):
- Criar `recalculate_operator_full` e `recalculate_my_full`.
- Agendar cron `*/30 * * * *` chamando a nova edge.

**Edge function** (1):
- `supabase/functions/gamification-recalc-tick/index.ts`.

**Frontend** (2):
- `src/hooks/useGamificationTrigger.ts` — simplificar para 1 RPC.
- `src/services/campaignService.ts` — usar RPCs unificadas em `computeCampaignScore`.

**Memória**:
- Atualizar `mem://features/gamification/logic-and-persistence` com o novo fluxo (1 RPC + cron).

---

### Validação

Após deploy:
1. Executar `recalculate_my_full` para Vitor → comparar com snapshot atual (R$ 37.885,02 / 5.126 pts esperados).
2. Confirmar que cron registrou em `audit_logs` na primeira execução.
3. Verificar que score de campanhas ativas atualizou sem necessidade de abrir a tela.

Posso executar?