## Objetivo
Reduzir o tempo de abertura da `/gamificacao` sem alterar nada visualmente. Foco: cortar cascata de queries, evitar montagem de todas as abas de uma vez, deduplicar recálculos e diminuir roundtrips no Postgres.

## Causas da lentidão (medidas)

1. **Todas as 7 abas montam no mount** (Radix `Tabs` monta cada `TabsContent`). Cada aba dispara queries + `supabase.channel(...).subscribe()` mesmo invisível.
2. **`recalculate_my_full` é disparado no mount da página** e o `GoalsTab` ainda dispara um **segundo** recálculo (`recalculateMySnapshot/Tenant`) ao montar — trabalho duplicado.
3. **`fetchRanking` faz 5 queries sequenciais** (participants → points → profiles → agreements → audit_logs) onde várias podem ser paralelas, e `audit_logs` é consultado mesmo quando o filtro pode ser feito numa única query.
4. **`fetchCampaignParticipants` → `attachLiveCampaignScores`** roda `Promise.all` com **3 queries por participante** (manual_payments, portal_payments, negociarie_cobrancas) — N×3 roundtrips por card. Em `CampaignsTab` ainda há um loop chamando `recalculateCampaignScores` para cada campanha ativa, redundante (já existe cron tick a cada 30 min).
5. **Realtime channels redundantes**: `RankingTab`, `CampaignsTab`, `GoalsTab` (indireto) e cada `CampaignCard` abrem channels — acumulam dezenas de subscribes em campanhas com vários cards.
6. `closeMut` e mutations OK; o problema é só leitura.

## Mudanças propostas (somente lógica/data fetching, **zero mudança visual**)

### 1) Lazy-mount das abas via Radix
Usar `forceMount` apenas quando necessário e renderizar o conteúdo da aba **somente quando ela é a `currentTab`** (early-return condicional dentro de cada `<TabsContent>`):
```tsx
<TabsContent value="ranking">
  {currentTab === "ranking" && <RankingTab .../>}
</TabsContent>
```
Aplicar a todas as 7 abas + 7 sub-abas de "Gerenciar". Resultado: na primeira renderização só monta a aba ativa (Ranking para admin / Metas para operador). Queries das outras abas só rodam quando o usuário clica.

### 2) Deduplicar recálculos
- Remover `recalculateMySnapshot/recalculateTenantSnapshot` do `useEffect` do `GoalsTab` — o `useGamificationTrigger` da página já cobre, e o cron `gamification-recalc-tick` mantém atualizado.
- Tornar o `triggerGamificationUpdate` da página **não-bloqueante visualmente**: já é `await`-free no JSX, mas garantir que ele rode em `requestIdleCallback` (fallback `setTimeout 0`) para não competir com as queries iniciais do header.

### 3) Reduzir roundtrips em `fetchRanking`
- Paralelizar com `Promise.all`: `participants`, `points` e `profiles` não dependem entre si (após termos o `tenantId`). Hoje são sequenciais.
- A consulta de `audit_logs` para detectar `selfCancelledIds` pode virar um `LEFT JOIN`/subquery via uma RPC SQL `get_ranking_with_agreements(_year, _month)` que retorna ranking + agreements_count em **uma única query**. Como queremos minimizar mudanças, alternativa mais barata: trocar a busca de `audit_logs` por uma só chamada paralela com `agreements` (já é, mas hoje fica em série após o select de agreements). Manter equivalência funcional 1:1.

### 4) Reduzir roundtrips em campanhas
- **Remover o loop `active.forEach(recalculateCampaignScores)`** do `CampaignsTab.useEffect`. Esse recálculo client-side é redundante com o cron tick e com o que `recalculate_my_full` já faz; gera N RPCs pesadas por mount.
- `attachLiveCampaignScores`: substituir os N×3 selects por uma única query agregada por campanha. Criar RPC `get_campaign_live_scores(_campaign_id uuid)` que devolve `[{operator_id, score}]` numa só ida ao banco usando o mesmo CTE `all_paid` já padronizado nas RPCs de BI. UI continua igual.
- Se preferir não criar RPC nova nesta passagem, fallback: ler `campaign_participants.score` direto (já é mantido pelo cron e pelo `recalculate_my_full`), removendo `attachLiveCampaignScores` por padrão e mantendo-o apenas como fallback opcional.

### 5) Consolidar Realtime
- Em `CampaignsTab`, usar **um único channel** para a tabela `campaign_participants` filtrado por `tenant_id`, e invalidar todas as queries de participants de uma vez — em vez de um channel por `CampaignCard`.
- Manter o channel de `RankingTab` apenas quando a aba está visível (graças à mudança 1, ele só monta quando ativo).

### 6) Pequenos ganhos adicionais
- `staleTime` mais generoso (60–120s) nas queries do header (`scoring-rules`, `rivocoin-wallet`, `achievements`, `campaigns`) para evitar refetch ao trocar de aba.
- `fetchAllAchievements` e `fetchMyAchievements` retornam essencialmente os mesmos dados — reaproveitar `earnedAchievements` do header dentro do `AchievementsTab` (operador) via a mesma `queryKey` para evitar refetch.
- Memoizar `adminPointsTotal`/`adminReceivedTotal` (`useMemo`) — minúsculo, mas evita re-cálculo a cada render.

## O que NÃO muda
- Nenhuma mudança em JSX visível, classes Tailwind, layout, copy, ícones, badges, animações.
- Nenhuma mudança em regras de pontuação, conquistas, metas ou cálculo de score.
- Nenhuma mudança em outras telas (Dashboard, Analytics, Carteira, etc.).
- Nenhuma alteração nas RPCs existentes (apenas **adicionar** opcionalmente `get_campaign_live_scores` em uma migration). Se você preferir não criar RPC nova, item 4 cai no fallback (ler `score` da tabela), também sem mudança visual.

## Ordem de execução
1. Lazy-mount das abas + remover recalc duplicado do `GoalsTab` + remover loop de `recalculateCampaignScores` no `CampaignsTab` (ganho imediato grande, zero risco).
2. Paralelizar `fetchRanking`.
3. Consolidar realtime de `CampaignsTab` (um channel só).
4. Substituir `attachLiveCampaignScores` por leitura direta de `campaign_participants.score` (fallback) **ou** criar RPC `get_campaign_live_scores` se quiser manter "score ao vivo" sem cascata.
5. Ajustar `staleTime`.

## Resultado esperado
- Mount inicial: de ~6–10 queries + N×3 por campanha + N RPCs `recalculate_campaign_scores` para **2–3 queries** + 1 RPC `recalculate_my_full` em background.
- Nº de WebSockets abertos no mount cai de 4–10 para 1.
- Tempo de "primeiro pixel útil" deve cair significativamente (especialmente em tenants com várias campanhas/operadores).
- Comportamento e UI idênticos.

Confirma que posso executar nessa ordem? Se quiser pular o item 4 (RPC nova) eu uso o fallback de leitura direta da coluna `score`.