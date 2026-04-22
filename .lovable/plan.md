

## Por que a campanha parou de novo (e o watchdog não destravou)

### Causa raiz (confirmada)

**Campanha:** `Disparo carteira 10:32` — agora em **30/199** (subiu de 14, watchdog re-invocou), mas voltou a travar às 15:43. Lock de `worker_b2285a8a` ativo desde 15:40, **1 recipient preso em `status=processing`**, 167 pendentes.

**Análise dos logs HTTP da edge (`function_edge_logs`)** — todas as últimas ~40 invocações de `send-bulk-whatsapp` retornam **HTTP 401 Unauthorized** em 145–555ms (sem boot do código). O dispatcher loga `[dispatcher] watchdog re-invoking 6c97163b…` corretamente, mas a chamada subsequente é rejeitada na borda da edge antes do código rodar.

**Por quê:** o `send-bulk-whatsapp` não tem bloco `[functions.send-bulk-whatsapp]` em `supabase/config.toml` → roda com `verify_jwt=true` (default). Tanto o `dispatch-scheduled-campaigns` (watchdog/one-shot/recurring) quanto o próprio `send-bulk-whatsapp` (self-retrigger) chamam usando `Authorization: Bearer ${SERVICE_ROLE_KEY}` — mas com a migração da plataforma para **signing keys assimétricas (ES256)**, o service role key estático **não satisfaz mais** o verificador JWT da edge, gerando 401 antes do código.

Resultado: cada tick do cron loga "re-invoking" mas **nada executa**. Watchdog vira teatro.

### Consequências em cascata

1. Worker que pegou o último ciclo (15:40) processou 16 mensagens (14→30), marcou 1 recipient como `processing`, atingiu timeout/erro, e **nenhuma invocação posterior conseguiu rodar** o cleanup → recipient órfão segura interpretação de "lock vivo" caso o `processing_locked_at` seja atualizado.
2. Mesma trava afeta **todas** as outras 14 campanhas em `sending` listadas (várias desde 14/04) — todas órfãs pelo mesmo motivo.

### Correções

**1) Desativar JWT no `send-bulk-whatsapp` via `supabase/config.toml`**

```toml
[functions.send-bulk-whatsapp]
verify_jwt = false
```

A função já valida o `tenant_id` por payload e usa service role internamente para escrever — não há ganho de segurança em manter `verify_jwt=true` aqui (todo cliente legítimo é o próprio dispatcher e o front via `supabase.functions.invoke`, ambos compatíveis). Após o deploy do config, os 401 viram 200 e watchdog/self-retrigger voltam a funcionar.

**2) Liberar recipient órfão em `processing`**

Migration utilitária: para a campanha `6c97163b…`, fazer `UPDATE whatsapp_campaign_recipients SET status='pending' WHERE campaign_id='6c97163b…' AND status='processing'` e zerar `processing_locked_at` da campanha. Generaliza-se para qualquer campanha `sending` com lock > 5min e recipient em `processing` > 5min — adicionar essa limpeza no início do `dispatch-scheduled-campaigns` (antes do watchdog) para que se auto-cure no futuro.

**3) Defesa extra no worker — converter `processing` órfão em retry**

No início do `processCampaignChunk` (após `try_lock_campaign`), rodar `UPDATE … SET status='pending' WHERE campaign_id=$1 AND status='processing' AND updated_at < now() - interval '5 minutes'`. Garante que recipient marcado como `processing` por worker que morreu volte para a fila no próximo ciclo.

**4) Validação pós-deploy**

1. Aplicar config + migration de cleanup.
2. Em ≤1min, cron `*/1` re-invoca `6c97163b…` — agora HTTP 200, contagem sai de 30 e progride.
3. Watchdog também destrava as outras 14 campanhas órfãs (várias completam em 1–2 ciclos pois têm <20 pending cada).
4. Conferir `function_edge_logs` — `send-bulk-whatsapp` passa a retornar 200, execution_time > 5s (boot + processamento real).
5. SQL final: `SELECT count(*) FROM whatsapp_campaigns WHERE status='sending' AND processing_locked_at < now() - interval '10 min'` → `0`.

### Arquivos alterados

- `supabase/config.toml` — adicionar bloco `[functions.send-bulk-whatsapp]` com `verify_jwt = false`.
- `supabase/migrations/<nova>.sql` — limpar `processing` órfão da campanha travada e zerar locks > 10min de todas em `sending`.
- `supabase/functions/dispatch-scheduled-campaigns/index.ts` — bloco de auto-cura no início (resetar recipients `processing` > 5min para `pending`).
- `supabase/functions/send-bulk-whatsapp/index.ts` — mesma defesa após `try_lock_campaign`.

### Fora de escopo

- Trocar `SERVICE_ROLE_KEY` por chave assinada nova (overkill se `verify_jwt=false` resolve para esta função interna).
- Refatorar para fila externa.
- Bug colateral `utf-8-validate` warning no boot (cosmético).

