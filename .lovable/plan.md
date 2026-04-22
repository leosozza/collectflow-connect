

## Diagnóstico: por que está demorando e por que “parece pausada”

### Estado real agora (campanha `Disparo carteira 10:32`)

- 84 pendentes, 102 enviados, 13 falhas, 1 entregue.
- `processing_locked_at = null`, `progress_metadata.timed_out = true`, `last_chunk_at` há ~7 minutos.
- O watchdog do `dispatch-scheduled-campaigns` está re-invocando a campanha a cada minuto (logs: `watchdog re-invoking 6c97163b… (pending=84, lock=null)`).
- O `send-bulk-whatsapp` boota e dá shutdown logo em seguida — sem nenhum log `[Anti-Ban] waiting…` nem `Lock not acquired`. Ou seja, **o worker está terminando antes de processar qualquer recipient**.

### Por que está “travado / lento”

1. **Anti-Ban hoje é muito conservador para volume real**: provedores não-oficiais usam **8–15 s entre mensagens** + **descanso de 2 min a cada 15 envios**. Em uma instância só, isso dá **~30–40 mensagens por minuto útil** e cada janela de 2 min de processamento empurra ~30 envios → as 84 pendentes precisam de no mínimo **3 ciclos de worker** (~6 min só de relógio, fora os descansos).

2. **Cada ciclo de worker dura no máximo 120 s** (`MAX_EXECUTION_MS = 120000`), depois o próprio worker se auto-reinvoca; se falhar, o cron watchdog assume em até 1 min. Hoje a campanha gastou os 120 s do ciclo, marcou `timed_out = true` e o auto-reinvoke não pegou (boot/shutdown no log sem trabalho efetivo).

3. **Na UI parece “pausada”** porque o card mostra a flag `timed_out / batch_resting` enquanto o próximo worker não pega trabalho. Não está pausada de fato — está em **gap entre ciclos**.

4. **Watchdog para campanhas com origem em campanha (não em workflow) está OK**, mas a janela `staleCutoff = 2 min` somada ao tempo de boot/heal/lock acaba gerando ~3 min sem progresso aparente.

### O sistema parou de pausar sozinho?

Não há mais o erro 409 em loop (o `try_lock_campaign` agora devolve 200 quando outro worker já tem o lock — não vira “pausa” na UI). O watchdog continua ativo e re-invoca campanhas órfãs. **Não há pausa automática** — o que dá impressão de pausa é o **gap entre ciclos do worker** descrito acima.

---

## Plano de correção

Foco: reduzir o tempo total de disparo **sem comprometer o anti-ban** e eliminar o gap visual entre ciclos.

### 1. Encurtar o gap entre ciclos do worker

- Subir `MAX_EXECUTION_MS` de **120 s → 220 s** (continua dentro do limite de 380 s do edge runtime, com folga para fechar). Isso quase dobra o trabalho útil por ciclo e reduz pela metade o número de re-invocações.
- Reduzir `staleCutoff` do watchdog de **2 min → 45 s** quando a campanha está sem lock e tem pendências. Hoje o gap entre ciclos chega a ~3 min porque o cron roda a cada minuto e só decide re-invocar depois de 2 min sem update.
- Garantir que o **auto-retrigger** dentro do worker (passo após `timed_out`) seja disparado **antes** do release de lock — hoje a sequência libera o lock e só depois faz o `fetch`, dando janela para o próximo cron passar e ainda achar “lock=null + pending” enquanto o retrigger ainda nem chegou. Inverter ordem: `fetch (fire-and-forget)` → `release_campaign_lock`.

### 2. Throttling adaptativo por instância

Hoje o `ThrottleConfig` é fixo por categoria. Proposta:

- Manter as **constantes anti-ban inalteradas** (8–15 s não-oficial, 1–3 s oficial, 3–6 s AI).
- **Round-robin entre instâncias já existe** (linha 346), então quanto mais instâncias ativas para a campanha, maior a vazão. Adicionar log explícito de quantas instâncias estão sendo usadas para o admin entender a vazão esperada.
- Adicionar um campo opcional `progress_metadata.eta_seconds` calculado por: `pending × avg_delay_ms / num_instances + restingTime`. Já fica visível no card de resumo da campanha.

### 3. Esclarecer estado “resting” vs “pausada” na UI

O `CampaignSummaryTab` hoje exibe badge único “Em andamento / Pausada / Concluída”. Adicionar microcópia abaixo do badge quando `progress_metadata.batch_resting === true`: **“Aguardando descanso anti-ban (2 min)”** e quando `timed_out === true && remaining > 0`: **“Reiniciando ciclo automaticamente (até 1 min)”**. Sem mexer em lógica, só feedback honesto.

### 4. Painel de diagnóstico mínimo (admin)

No `CampaignDetailView`, adicionar uma linha discreta com:

- Última atividade (`last_chunk_at`).
- Lock atual (`processing_locked_by` ou “livre”).
- Próxima ação prevista (resting / aguardando worker / concluída).

Sem novas tabelas — tudo já existe em `whatsapp_campaigns.progress_metadata`.

### 5. (Opcional) Habilitar paralelismo manual por campanha

Hoje a campanha usa as instâncias atribuídas ao destinatário (`assigned_instance_id`). Se a campanha tem só **uma** instância dedicada (caso da Sabrina), a vazão é limitada por anti-ban. Para campanhas grandes, o admin pode habilitar uma flag opcional `allow_multi_instance_fanout` (default: false, sem impacto retroativo) que distribui pendentes entre todas as instâncias `connected` do tenant. Fora do escopo desta rodada se não for solicitado.

---

## O que muda / não muda

- **Anti-ban (8–15 s, 2 min de descanso a cada 15) — INTACTO.**
- **Webhooks, motor de envio, RLS, visibilidade da Sabrina — INTACTOS.**
- Worker fica mais produtivo por ciclo (menos boot/teardown).
- Watchdog fica mais responsivo (45 s em vez de 2 min).
- UI passa a explicar honestamente o estado (resting / reiniciando) sem dizer “pausada”.

## Arquivos alterados

- `supabase/functions/send-bulk-whatsapp/index.ts` — `MAX_EXECUTION_MS`, ordem do retrigger.
- `supabase/functions/dispatch-scheduled-campaigns/index.ts` — `staleCutoff` para 45 s.
- `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx` — microcópia de estado real.
- `src/components/contact-center/whatsapp/campaigns/CampaignDetailView.tsx` — linha de diagnóstico.

## Validação pós-deploy

1. Disparar uma campanha com 100+ destinatários e cronometrar.
   - Esperado: vazão sustentada de ~30–40 msg/min por instância não-oficial; sem janelas > 60 s sem envio (exceto durante descanso de 2 min, que mostra explicitamente “Aguardando descanso anti-ban”).
2. Conferir nos logs do `send-bulk-whatsapp` que cada ciclo processa ~25–30 mensagens (em vez dos ~12–15 de hoje).
3. Conferir que o watchdog re-invoca em <1 min após `timed_out`, sem o gap atual de 3 min.
4. UI nunca mais mostra “Pausada” durante operação normal — só “Em andamento” + microcópia explicando descanso/reinício.

## Fora de escopo

- Reescrever o motor anti-ban.
- Multi-instance fan-out automático para campanhas com instância única (item 5, opcional).
- Mudar UI da Carteira ou regras de visibilidade da Sabrina (já entregues nas rodadas anteriores).

