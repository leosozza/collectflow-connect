

## Plano: Taxa de Entrega sempre 0% — propagar `delivered`/`read` dos webhooks até a campanha

### Diagnóstico

A `Taxa de Entrega` é calculada como `delivered_count / sent_count`. Em **todas** as campanhas do banco (histórico inteiro), `delivered_count = 0`. Conferi:

- Nenhuma Edge Function escreve `whatsapp_campaigns.delivered_count` (busca por `delivered_count` em `supabase/functions/**`: 0 ocorrências).
- Os webhooks (`gupshup-webhook` e `whatsapp-webhook`/Evolution) recebem corretamente eventos `delivered`/`read` (status 3/4/5 da Evolution, `message-event` da Gupshup) e atualizam `chat_messages.status`.
- Mas **não** atualizam `whatsapp_campaign_recipients.status` nem `delivered_at`/`read_at`, mesmo já existindo o casamento natural via `provider_message_id` (a coluna existe em ambas as tabelas e é gravada no envio em `send-bulk-whatsapp/index.ts` linha 453).
- Resultado: o recipient da campanha permanece em `sent`, e o agregado nunca é atualizado.

A campanha `Disparo carteira 10:32` está com 88 `sent`, 10 `failed`, 101 `pending` no nível de recipient, e 0 entregues — coerente com a falha sistêmica, não com o provedor.

### Correção (3 frentes)

#### 1. Webhook Evolution (`whatsapp-webhook/index.ts`) — propagar status para a campanha

No bloco `messages.update` (linhas 334–356), além de atualizar `chat_messages.status`:

- Atualizar `whatsapp_campaign_recipients` casando por `provider_message_id = externalId`:
  - Se status = `delivered`: setar `status='delivered'`, `delivered_at=now()` (somente se ainda não estiver `read`).
  - Se status = `read`: setar `status='read'`, `read_at=now()`, e `delivered_at=COALESCE(delivered_at, now())`.
- Para cada linha efetivamente atualizada, recomputar e gravar os contadores no `whatsapp_campaigns` correspondente (ver item 3).

#### 2. Webhook Gupshup (`gupshup-webhook/index.ts`) — mesmo tratamento

No bloco `message-event` / `status` (linhas 269–318), após atualizar `chat_messages`:

- Atualizar `whatsapp_campaign_recipients` por `provider_message_id = gsMessageId` com a mesma lógica de transição (`delivered` → `read` é progressão; nunca regredir).
- Para `failed` recebido após `sent` (raro, mas possível na Gupshup): atualizar recipient para `failed` e gravar `error_message` com o `providerError` já calculado.
- Disparar a recomputação de contadores (item 3).

#### 3. Recomputação atômica de contadores — RPC `recompute_campaign_counters(_campaign_id uuid)`

Criar uma função SQL `SECURITY DEFINER` curta que:

```sql
UPDATE whatsapp_campaigns c SET
  sent_count      = (SELECT COUNT(*) FROM whatsapp_campaign_recipients WHERE campaign_id=c.id AND status IN ('sent','delivered','read')),
  delivered_count = (SELECT COUNT(*) FROM whatsapp_campaign_recipients WHERE campaign_id=c.id AND status IN ('delivered','read')),
  read_count      = (SELECT COUNT(*) FROM whatsapp_campaign_recipients WHERE campaign_id=c.id AND status='read'),
  failed_count    = (SELECT COUNT(*) FROM whatsapp_campaign_recipients WHERE campaign_id=c.id AND status='failed'),
  updated_at      = now()
WHERE c.id = _campaign_id;
```

Vantagens: idempotente, livre de race condition, fonte única de verdade derivada do recipient. Os webhooks chamam essa RPC após cada update de recipient que envolva campanha. O worker `send-bulk-whatsapp` continua incrementando direto (rápido), mas o snapshot final fica sempre coerente.

#### 4. Backfill histórico (one-shot)

Migration que executa `recompute_campaign_counters` em todas as campanhas existentes para preencher `delivered_count`/`read_count` retroativamente onde os webhooks já chegaram (vai ficar 0 para campanhas onde recipients estão só em `sent`, mas corrige automaticamente as que tiverem callbacks futuros).

Para a campanha `Disparo carteira 10:32` em andamento: rodar uma vez para sincronizar `sent_count` com a contagem real de recipients (88 vs 86 mostrado na UI).

### O que não muda

- Lógica de envio anti-ban (delays, lotes, watchdog) — intacta.
- UI de `CampaignSummaryTab` — já consome `delivered_count` ao vivo via polling (corrigido na rodada anterior). Assim que o backend popular o campo, o card "Taxa de Entrega" passa a refletir em tempo real.
- Schema das tabelas — sem novas colunas.

### Arquivos alterados

- `supabase/functions/whatsapp-webhook/index.ts` — bloco `messages.update`.
- `supabase/functions/gupshup-webhook/index.ts` — bloco `message-event/status`.
- Migration SQL — RPC `recompute_campaign_counters` + backfill.

### Validação pós-deploy

1. Esperar ~1–2 min após o próximo lote da campanha em curso.
2. Conferir no banco: `SELECT sent_count, delivered_count, failed_count FROM whatsapp_campaigns WHERE id='6c97163b…'`. `delivered_count` deve subir conforme webhooks chegam.
3. Na UI (Resumo da campanha), o card "Taxa de Entrega" deixa de mostrar `0.0%` e passa a refletir a relação real entregues/enviados.
4. Em campanhas via Gupshup oficial, idem com `read_count` subindo quando o destinatário abrir.

### Fora de escopo

- Reescrever o motor anti-ban.
- Painel de tracking individual por recipient (já existe na aba Destinatários e passará a refletir `delivered_at`/`read_at` automaticamente).
- Criar evento de "lido" na timeline do cliente — pode entrar em rodada separada se houver demanda.

