## Diagnóstico — Campanha "Disparo carteira 09:34" parou sozinha

### Estado atual
- Campanha `a2ccfecb-…596a`, status `sending`, **sent_count=8 / failed=7 / total=70**, **55 destinatários `pending`**.
- `processing_locked_at = NULL` → nenhum worker está segurando o lock.
- `progress_metadata.last_chunk_at = 12:38:07Z` → último chunk há mais de 9 minutos. `timed_out=false` (worker morreu sem marcar timeout).
- Falhas (7): todas `400 Bad Request "exists":false` da Evolution = números sem WhatsApp. Não é causa do travamento, são naturais.
- 4 instâncias evolution conectadas, todas com `pending` distribuídos (~13–15 cada). Saúde das instâncias OK.

### Causa-raiz identificada

O **watchdog/dispatcher** do `dispatch-scheduled-campaigns` está re-invocando a campanha a cada minuto (logs: `[dispatcher] watchdog re-invoking a2ccfecb-... (pending=55, lock=null)`), mas **toda chamada para `send-bulk-whatsapp` está retornando HTTP 401** no gateway:

```
POST | 401 | …/send-bulk-whatsapp execution_time_ms:160
POST | 401 | …/send-bulk-whatsapp execution_time_ms:191
POST | 401 | …/send-bulk-whatsapp execution_time_ms:200
…  (loop a cada ~60s)
```

Os 401 retornam antes do boot da função (sem logs de execução em `send-bulk-whatsapp`), ou seja, **o gateway está bloqueando antes do handler rodar** — o código nunca chega a checar `isSystemCall`.

As três chamadas internas que disparam o worker são feitas via `fetch` direto:

1. `dispatch-scheduled-campaigns` → linha 360, 463 (watchdog + recurring)
2. `send-bulk-whatsapp` self-retrigger no timeout → linha 670

Todas enviam apenas:
```ts
headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
```

Falta o header **`apikey`**. O gateway de Edge Functions do Supabase, mesmo com `verify_jwt = false`, exige `apikey` (ou que o Authorization seja um JWT de usuário válido). Como o service-role JWT está só no Authorization, sem `apikey`, a borda devolve 401 → o handler nunca roda → o lock não é adquirido → os 55 pendentes ficam parados para sempre.

A invocação inicial pelo client (`supabase.functions.invoke` na UI) funciona porque o SDK injeta `apikey` automaticamente. Por isso 8 mensagens saíram no início e depois travou.

### Correção proposta

**Edge functions** — adicionar header `apikey` em todas as 3 invocações fetch:

`supabase/functions/dispatch-scheduled-campaigns/index.ts` (linhas 358–365 e 461–469):
```ts
headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
}
```

`supabase/functions/send-bulk-whatsapp/index.ts` (linhas 670–678 — self-retrigger):
```ts
headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${serviceKey}`,
  apikey: serviceKey,
}
```

(Mesma correção também resolve o watchdog do `recurring`.)

**Recuperação imediata da campanha travada**

Após o deploy, basta uma query manual para destravar a campanha atual e o watchdog seguinte do dispatcher (em <1 min) re-invocará e processará os 55 restantes:

```sql
UPDATE whatsapp_campaigns
SET processing_locked_at = NULL, processing_locked_by = NULL
WHERE id = 'a2ccfecb-e3f3-44d0-9f0c-f804d19b596a';

UPDATE whatsapp_campaign_recipients
SET status = 'pending', claimed_at = NULL, claimed_by = NULL
WHERE campaign_id = 'a2ccfecb-e3f3-44d0-9f0c-f804d19b596a'
  AND status = 'processing';
```
(o lock já está null e não há `processing` no momento, mas o script é seguro/idempotente).

### Validação pós-deploy

1. Abrir logs do `dispatch-scheduled-campaigns` no próximo minuto e confirmar mensagem `watchdog re-invoking …`.
2. Abrir logs do `send-bulk-whatsapp` e ver `booted` + `[Anti-Ban] Instance …` + `[Campaign] Lock acquired`.
3. `whatsapp_campaign_recipients` da campanha sair de `pending=55` para zero ao longo dos próximos minutos (4 instâncias × ~12 msgs).
4. Status final da campanha vira `completed` ou `completed_with_errors`.

### Por que isso só apareceu agora

A correção mais recente trocou alguns invokers internos por `fetch` direto (em vez de `supabase.functions.invoke`) para ganhar fire-and-forget e `EdgeRuntime.waitUntil`. Sem o header `apikey`, qualquer campanha que dependesse do watchdog/self-retrigger (basicamente toda campanha grande que excede os 380 s do edge runtime) ficaria travada após o primeiro chunk. Esta é provavelmente a causa de "parou sozinha" relatado.

### Riscos / efeitos colaterais

Nenhum. Adicionar `apikey` não muda lógica de negócio nem de auth — o handler já segrega `isSystemCall` pelo Bearer service-role. É apenas o gateway que precisa do header extra.
