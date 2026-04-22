

## Por que o disparo parou em 14/199 e como tornar verdadeiramente "background"

### Causa raiz (confirmada)

**Campanha:** `Disparo carteira 10:32` — id `6c97163b…`, status `sending`, 14 processados, **184 pendentes**, lock ativo desde 13:32 (worker `worker_5b826c4d`), último chunk às 13:35:42 (sem progresso há ~12min).

A função `send-bulk-whatsapp` tem janela máxima de **380s** por execução (`MAX_EXECUTION_MS = 380000`). Quando estoura:
1. Marca `progress_metadata.timed_out=true`, libera o lock e devolve `status:partial`.
2. **Não dispara nada para retomar.**

A retomada depende exclusivamente do cron `wa-campaign-scheduler`, mas esse cron (`dispatch-scheduled-campaigns`) só busca campanhas com `status='scheduled' AND scheduled_for <= now()`. Campanhas em `sending` com `pending` restantes ficam **órfãs para sempre** até alguém reabrir manualmente.

Adicionalmente, a saída do navegador **não interfere** no processamento (já é fire-and-forget pelo dispatcher), mas como não há watchdog, o usuário percebe como "parou quando saí da página" — coincidência: o timeout de 380s bate quase com o tempo que ele ficou na tela.

### Correções

**1) Watchdog no `dispatch-scheduled-campaigns` (cron já roda a cada 1min)**

Adicionar segunda query no scan: campanhas `status='sending'` com `processing_locked_at IS NULL` (ou `< now() - 2 min`) **E** com recipients pendentes. Para cada uma, fazer fire-and-forget POST para `send-bulk-whatsapp` com `{ campaign_id }` (mesmo padrão de `dispatchOneShot`). O `try_lock_campaign` já protege contra dupla execução (lock de 10min).

```sql
SELECT id FROM whatsapp_campaigns
WHERE status = 'sending'
  AND (processing_locked_at IS NULL OR processing_locked_at < now() - interval '2 minutes')
  AND EXISTS (SELECT 1 FROM whatsapp_campaign_recipients
              WHERE campaign_id = whatsapp_campaigns.id AND status IN ('pending','processing'))
LIMIT 20;
```

**2) Self-retrigger no `send-bulk-whatsapp`**

Antes de retornar `status:partial` (linha ~514), fazer fire-and-forget POST para si mesma com o mesmo `campaign_id`. Isso garante continuidade imediata em vez de esperar o cron de 1min. Defensivo: o lock já foi liberado e `try_lock_campaign` re-protege a próxima invocação.

**3) Recuperar a campanha travada agora (one-shot)**

Como a `Disparo carteira 10:32` está parada, basta forçar um chamado da edge function (o watchdog faria isso automaticamente após o deploy). Faço via SQL `net.http_post` ou pelo próprio cron quando rodar.

**4) Endpoint manual "Retomar" na UI da campanha** (opcional, mas útil)

Botão "Retomar disparo" no header da página de detalhes (já mostra "Em ritmo / Próximo envio em breve") quando `status='sending'` e `progress_metadata.timed_out=true` ou `last_chunk_at` > 3min. Chama `send-bulk-whatsapp` com `{campaign_id}`. Permite intervenção sem esperar 1min do cron.

**5) Bug não-crítico colateral**

`dispatch-scheduled-campaigns` registra erros no boot (`utf-8-validate` / `bufferutil` not found). Vem do `@supabase/supabase-js@2.50.0` tentando carregar deps opcionais de WebSocket. **Não afeta runtime** (warnings inertes), mas poluem logs. Trocar import para `@2.39.0` (versão usada pelas demais functions, sem warning) opcionalmente.

### Validação pós-implementação

1. Deploy do watchdog + self-retrigger.
2. Em ≤1 min, cron detecta `Disparo carteira 10:32` órfã e re-invoca → contador sobe acima de 14.
3. Rodar até completar 199 (em ~3 ciclos de 380s ≈ 20min com anti-ban unofficial 8-15s + descanso de 2min a cada 15 msgs).
4. Verificar no SQL: `status='completed'`, `sent_count + failed_count = 199`, `progress_metadata.remaining = 0`.
5. Conferir logs: cada ciclo registra `[Campaign] Lock not acquired` em invocações concorrentes (prova que o lock funciona) e `[dispatcher] watchdog re-invoked X` para rastreio.

### Arquivos alterados

- `supabase/functions/dispatch-scheduled-campaigns/index.ts` — adicionar bloco watchdog antes do scan de `scheduled`.
- `supabase/functions/send-bulk-whatsapp/index.ts` — self-retrigger no caminho `timedOut && remaining > 0`.
- `src/pages/CampanhasWhatsAppDetail.tsx` (ou equivalente) — botão "Retomar disparo" condicional.

### Fora de escopo

- Aumentar `MAX_EXECUTION_MS` (limite hard do edge runtime ~400s — não compensa).
- Mexer em janelas/throttle anti-ban (já calibrado).
- Refatorar dispatcher para fila externa (Redis/BullMQ) — fora do stack Lovable Cloud.

