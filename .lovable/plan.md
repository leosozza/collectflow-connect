## Objetivo

Tornar o módulo Gamificação totalmente reativo (Realtime), reorganizar a aba Campanhas (ativas no topo, encerradas/rascunho colapsadas) e implementar **encerramento automático de campanha em horário definido**, com notificação no sininho e um **modal de celebração** (1ª vez por operador por campanha) que parabeniza top 3 com fogos e incentiva os demais.

## 1. UI da aba Campanhas

`src/components/gamificacao/CampaignsTab.tsx`:
- "Campanhas Ativas" no topo (sempre aberto).
- Bloco **Collapsible** (Radix) "Outras campanhas (N)" colapsado por padrão para `encerrada`/`rascunho`/expiradas.
- Helper local `isCampaignActive(c)` (status `ativa` + datas válidas + `daysLeft >= 0`).
- **Sem** botão de recalcular (recálculo é automático via cron/triggers).

## 2. Realtime no módulo Gamificação

Em `CampaignsTab.tsx` e `CampaignCard.tsx`, criar canais Supabase Realtime que invalidam as queries TanStack ao receber `postgres_changes`:
- `gamification_campaigns` → invalida `["campaigns", tenantId]`.
- `campaign_participants` → invalida `["campaign-participants", campaign_id]`.
- `campaign_credores` → invalida `["campaigns", tenantId]`.
- `operator_points` (no `RankingTab`) → invalida `["ranking", year, month]`.

Cleanup com `removeChannel` no unmount.

Migração SQL:
```sql
ALTER TABLE public.gamification_campaigns REPLICA IDENTITY FULL;
ALTER TABLE public.campaign_participants REPLICA IDENTITY FULL;
ALTER TABLE public.campaign_credores REPLICA IDENTITY FULL;
ALTER TABLE public.operator_points REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gamification_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_credores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_points;
```
(idempotente / com `IF NOT EXISTS` quando aplicável).

## 3. Horário de encerramento da campanha

Schema:
```sql
ALTER TABLE public.gamification_campaigns
  ADD COLUMN IF NOT EXISTS end_time time without time zone NOT NULL DEFAULT '23:59:00',
  ADD COLUMN IF NOT EXISTS auto_closed_at timestamptz NULL;
```

Em `CampaignForm.tsx` adicionar um campo "Horário de encerramento" (input `time`, default `23:59`). `campaignService.Campaign` ganha `end_time`.

### Edge function de encerramento automático

Nova função `supabase/functions/gamification-campaign-closer/index.ts`:
- Lista campanhas com `status = 'ativa'` cujo `end_date + end_time` (no fuso `America/Sao_Paulo`) já passou e `auto_closed_at IS NULL`.
- Para cada uma:
  1. Roda `recalculateCampaignScores` (lógica do `campaignService` portada para SQL/RPC ou reaproveita a já existente RPC `close_campaign_and_award_points`).
  2. Chama `close_campaign_and_award_points(_campaign_id)` (já existe).
  3. Marca `status = 'encerrada'`, `auto_closed_at = now()`.
  4. Insere notificações na tabela `notifications` para cada participante (uma por operador), com `category = 'gamification_campaign_closed'`, payload `{ campaign_id, title, position, score, total_participants }`.

Cron a cada 5 min via `pg_cron + pg_net` (`select cron.schedule(...)` chamando a função). Será inserido com a ferramenta de insert (não migration), pois contém URL/anon key.

## 4. Notificação no sininho

`src/services/notificationService.ts` e `NotificationBell` já consomem a tabela `notifications`. Apenas adicionamos o tipo `gamification_campaign_closed` na renderização de `NotificationList.tsx` com ícone `Trophy` e link que abre o modal de celebração na próxima visita à `/gamificacao?tab=campaigns&celebrate=<campaign_id>`.

## 5. Modal de celebração (1x por operador por campanha)

Novo componente `src/components/gamificacao/CampaignCelebrationModal.tsx`:
- Centro da tela (Dialog shadcn).
- **Top 1/2/3**: confetes (`canvas-confetti` já está disponível? caso não, instalar `canvas-confetti`), título "🥇 Parabéns, campeão!" / "🥈 Vice-campeão!" / "🥉 3º lugar!", nome da campanha, prêmio, score.
- **4º+**: mensagem motivacional "Você ficou em Xº lugar. Continue firme — a próxima é sua!" sem fogos.
- Botão fechar (X) no canto.

Persistência (1x por operador por campanha):
- Tabela nova:
```sql
CREATE TABLE public.campaign_celebration_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.gamification_campaigns(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, operator_id)
);
ALTER TABLE public.campaign_celebration_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant isolation" ON public.campaign_celebration_views
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
```

Lógica:
- Hook `useCampaignCelebrations()` montado em `AppLayout` (autenticado). Busca campanhas com `status = 'encerrada'` + `auto_closed_at` recente (últimos 30 dias) onde o usuário é participante e não há registro em `campaign_celebration_views` para ele.
- Enfileira modais; ao fechar (X), insere a row em `campaign_celebration_views` (não reabre mais, em nenhuma sessão).
- Como o hook roda no layout autenticado, se o operador não estava logado quando a campanha encerrou, o modal aparece logo após o login. Subscription Realtime em `campaign_celebration_views` + `gamification_campaigns` mantém isso vivo enquanto a sessão está aberta.

## 6. Detalhes técnicos

- Critério "ativa" centralizado em helper.
- `recalculate_my_full` continua sendo chamado em mount da página (`useGamificationTrigger`), mas com Realtime ativo o recálculo de UI passa a ser passivo.
- Confetes leves: `canvas-confetti` (~6kb gz). Instalar via `bun add canvas-confetti`.
- Toda subscription/canal usa nome com `tenantId` para evitar colisão entre tenants.
- Notificações respeitam RLS de `notifications` já existente.

## Arquivos afetados / novos

- `src/components/gamificacao/CampaignsTab.tsx` — colapsar inativas, Realtime.
- `src/components/gamificacao/CampaignCard.tsx` — remover botão "Recalcular Ranking", subscription pontual.
- `src/components/gamificacao/CampaignForm.tsx` — campo "Horário de encerramento".
- `src/components/gamificacao/RankingTab.tsx` — Realtime em `operator_points`.
- `src/components/gamificacao/CampaignCelebrationModal.tsx` — novo.
- `src/hooks/useCampaignCelebrations.ts` — novo.
- `src/components/AppLayout.tsx` — montar o hook de celebração.
- `src/components/notifications/NotificationList.tsx` — render do tipo `gamification_campaign_closed`.
- `src/services/campaignService.ts` — tipo `end_time`, remoção do export `recalculateCampaignScores` do uso de UI (mantém para edge function).
- `supabase/functions/gamification-campaign-closer/index.ts` — novo.
- Migration: `end_time`, `auto_closed_at`, tabela `campaign_celebration_views`, RLS, REPLICA IDENTITY + publicação Realtime.
- Insert (não migration): cron `pg_cron` chamando a edge function a cada 5 min.

## Fora do escopo

- Não alterar fórmulas de pontuação nem RPCs existentes.
- Não mudar permissões/roles.
