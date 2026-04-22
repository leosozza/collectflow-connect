

## Plano: campanha de WhatsApp para no meio do disparo (nunca finaliza)

### Por que não termina

A campanha **`Disparo carteira 10:32`** está agora em `sending` com **59 enviados, 5 falhas, 135 pendentes**, lock travado em `worker_25c1373f` desde 19:32 UTC e o último checkpoint às 19:33:50 — ou seja, o worker morreu há ~10 minutos atrás e ninguém reiniciou.

Investigando, descobri o que está faltando:

1. O `send-bulk-whatsapp` tem limite forçado de **120 s por execução** (`MAX_EXECUTION_MS`) por causa do hard-limit de 150 s do edge runtime. Ao expirar, ele:
   - libera o lock,
   - re-marca recipients `processing` → `pending`,
   - dispara um **self-retrigger** via `fetch()` para si mesmo (fire-and-forget).
2. Esse self-retrigger é frágil: qualquer falha de rede, restart do runtime ou race com outro worker faz a corrente parar — e **não tem ninguém para ressuscitar**.
3. Existe um watchdog perfeito embutido no `dispatch-scheduled-campaigns` (linhas 432-466): ele varre toda hora campanhas em `sending` com lock vazio/stale e dispara um novo worker. **Mas a função nunca foi agendada no `pg_cron`.** Conferi todas as migrations: `pg_cron` está habilitado, mas nenhum `cron.schedule(...)` aponta para `dispatch-scheduled-campaigns`. Sem o cron, o watchdog nunca roda.

A frase do usuário "para quando saio da tela" é **engano de causalidade**: sair/entrar da tela não interrompe nada (`startCampaign` é `fire-and-forget` server-side). O que acontece é coincidência temporal — a primeira janela de 120 s aconteceu enquanto a tela estava aberta (49 enviados), depois a corrente quebrou e ninguém retomou.

### O usuário pediu: "sem limitador, mas respeitando o período de envio"

Entendo que isso significa:
- **Manter** os delays anti-ban entre mensagens (8-15 s não-oficial, 1-3 s oficial) e a pausa de lote (2 min a cada 15 mensagens). Esses são o "período de envio" que protege contra ban.
- **Remover** a sensação de "pára sozinho" — a campanha precisa drenar até o último destinatário sem depender de o usuário ficar com a tela aberta nem de o navegador retransmitir nada.

### Correção (3 frentes, cirúrgica)

#### 1. Agendar o cron do dispatcher (raiz do problema)

Migration nova que cria:
```sql
SELECT cron.schedule(
  'whatsapp-dispatch-scheduled-campaigns',
  '* * * * *',  -- a cada minuto
  $$ SELECT net.http_post(
       url := 'https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/dispatch-scheduled-campaigns',
       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <service_role>'),
       body := '{}'::jsonb
     ); $$
);
```

A partir desse momento, **toda campanha em `sending` com worker morto é ressuscitada em até 60 s automaticamente**, até drenar todos os pendentes. Sem aumentar nada nos delays.

#### 2. Reforçar o self-retrigger do worker para ser mais resiliente

Em `send-bulk-whatsapp` (final do `handleCampaignFlow`), trocar o `fetch().catch()` por `EdgeRuntime.waitUntil(fetch(...))`. Isso garante que o runtime não mate o socket antes da requisição sair. Hoje, sob carga, o `catch()` engole o erro e o retrigger morre.

#### 3. Reset manual da campanha travada da Bárbara

Migration one-shot só para essa campanha:
- Liberar `processing_locked_at = NULL` em `whatsapp_campaigns` para `6c97163b…`.
- Resetar `processing` → `pending` nos recipients dela (se houver).
- Disparar manualmente `send-bulk-whatsapp` via `pg_net` para retomar imediatamente sem esperar 60 s do cron.

### O que **não** vou alterar (proteção anti-ban permanece)

- `MIN_DELAY_MS` / `MAX_DELAY_MS` por categoria (8-15 s não-oficial) — mantidos.
- `BATCH_THRESHOLD` / `BATCH_REST_MS` (15 msgs → pausa 2 min) — mantidos.
- `MAX_EXECUTION_MS = 120000` por worker — mantido (é limite do runtime, não do produto).

A "sem limitador" do pedido vira: sem limite de quantos workers serão acionados em sequência. O cron + self-retrigger garantem que a corrente continue de onde parou, indefinidamente, até `pending = 0`.

### Arquivos alterados

- `supabase/migrations/<novo>.sql` — `cron.schedule('whatsapp-dispatch-scheduled-campaigns', '* * * * *', …)` + reset da campanha `6c97163b…` + `net.http_post` para retomar imediatamente.
- `supabase/functions/send-bulk-whatsapp/index.ts` — envolver o self-retrigger em `EdgeRuntime.waitUntil(...)` para garantir a saída do request mesmo no fim do ciclo de vida do worker.

### Validação pós-deploy

1. Em ≤ 60 s, a campanha `Disparo carteira 10:32` da Bárbara volta a `processing_locked_at` preenchido com novo `worker_*` e `sent_count` começa a subir de 59 em diante.
2. Em ~30-40 min (135 pendentes × ~12 s + 9 pausas de 2 min), a campanha vira `completed` ou `completed_with_errors` automaticamente, sem ninguém precisar manter tela aberta.
3. Logs do `dispatch-scheduled-campaigns` mostram, a cada minuto: `watchdog re-invoking ... (pending=N)` enquanto há pendentes; depois para de aparecer.
4. Criar uma campanha-teste com 30 destinatários e fechar a aba imediatamente após disparar → conferir que finaliza sozinha.

### Fora de escopo

- Trocar o motor anti-ban (delays continuam exatos como estão).
- Refatorar `send-bulk-whatsapp` para multiprocessing por instância (já é round-robin por instância na arquitetura atual).
- Adicionar UI de "pausar campanha" (existe outra história, fora deste fix).

