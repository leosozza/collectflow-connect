
## Auditoria + Correções do módulo de Agendamento/Recorrência

Li toda a implementação e rodei a verificação. Encontrei **1 bug crítico que impede o agendamento de funcionar** e mais 4 correções que evitam regressões em cenários específicos.

### 🔴 Bugs encontrados

#### 1. CRÍTICO — Cron job nunca foi criado
A migration criou as extensões `pg_cron`/`pg_net`, mas **não agendou nada**. Hoje uma campanha com `status='scheduled'` fica parada para sempre porque ninguém chama `dispatch-scheduled-campaigns`.

A instrução oficial do Lovable diz para NÃO colocar o `cron.schedule(...)` em migration (contém service_role/URL específicos do projeto). Deve ser rodado via `psql` / insert direto no banco, **uma única vez**.

**Fix:** executar via `psql` a chamada `cron.schedule('wa-campaign-scheduler', '* * * * *', ...)` apontando para `https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/dispatch-scheduled-campaigns` com `Authorization: Bearer <anon_key>`. O edge usa `service_role` internamente; o cron só precisa disparar o HTTP.

#### 2. 🔴 `fireNowScheduledCampaign` não funciona em campanhas `paused`
O código atualiza `scheduled_for=now()` e aceita `status IN ('scheduled','paused')`, **mas o dispatcher só busca `status='scheduled'`**. Resultado: clicar em "Disparar agora" numa recorrente pausada não faz nada.

**Fix:** forçar `status='scheduled'` no update (além de `scheduled_for=now()`).

#### 3. 🟠 `AlertDialogDescription` contém `<Input>` e `<Label>` interativos
O Radix renderiza `AlertDialogDescription` como `<p>` (ou, com `asChild`, herda o role semântico). Colocar Inputs/sliders dentro gera warning de acessibilidade ("Description should not contain interactive elements") e pode quebrar leitores de tela.

**Fix:** extrair o bloco de agendamento + nome + inputs do `AlertDialogDescription` para fora dele (manter só o título/descrição curta lá). Mover o conteúdo interativo para um `<div>` irmão dentro do `AlertDialogContent`.

#### 4. 🟡 Janela de envio fecha exatamente às 20h em recorrência
Comparação `hhmm > rule.window_end` exclui `20:00` (quando janela é 08–20). Se o usuário agenda 20:00, nunca dispara naquele minuto — sempre pula para o próximo dia.

**Fix:** trocar `>` por `>=` apenas quando for estritamente depois do fim, ou usar `>` com comparação correta (manter `>` mas considerar o fim inclusive: `hhmm < window_start || hhmm >= nextMinuteOfEnd`). Solução mais simples: `hhmm < window_start || hhmm > window_end` + permitir o minuto exato do fim → manter `>` mas documentar que `window_end` é exclusivo. Vou padronizar para **inclusivo no início, exclusivo no fim** e deixar comentário.

#### 5. 🟡 Edge dispatcher pode enfileirar 2 disparos simultâneos numa recorrente
Em `dispatchRecurring`, entre o `INSERT` da criança e o `UPDATE` da mãe há uma janela onde, se o cron rodar de novo (a cada minuto), a mãe ainda está com `status='scheduled'` e `scheduled_for <= now()` — dispara clone duplicado.

**Fix:** no início de `dispatchRecurring`, fazer flip atômico `scheduled_for = null` (ou status temporário `'processing'`) com `WHERE id=? AND status='scheduled' AND scheduled_for <= now()`. Se 0 linhas afetadas, abortar (race perdida). Ao final, gravar o próximo `scheduled_for` e voltar status para `'scheduled'`.

### ✅ O que está correto (auditado)
- Cálculo de timezone America/Sao_Paulo (UTC-3): lógica em `computeNextRun` tanto no edge quanto no client mirror está matematicamente correta.
- `distributeWeighted`: ajuste de resto e re-shuffle OK.
- Anti-ban no `send-bulk-whatsapp`: intocado e sólido (8–15s + 120s/15msg por instância).
- RLS da tabela `whatsapp_campaign_runs`: tenant isolado + service_role com acesso total.
- Permissões: `admin`/`super_admin` + delegação via `user_permissions` funcionando.
- UI de gestão (filtro Agendadas/Pausadas, countdown, Ver execuções, Editar regra).

### Arquivos que serão alterados

1. **`psql` insert (via exec, NÃO migration)** — cria o cron job `wa-campaign-scheduler` rodando a cada 1 min.
2. **`src/services/whatsappCampaignService.ts`** — `fireNowScheduledCampaign` força `status='scheduled'`.
3. **`src/components/carteira/WhatsAppBulkDialog.tsx`** — refatorar `AlertDialogContent` movendo inputs para fora do `AlertDialogDescription`.
4. **`supabase/functions/dispatch-scheduled-campaigns/index.ts`** — flip atômico anti-race na recorrência + fix de `window_end` inclusivo.

### Fora de escopo
- `send-bulk-whatsapp` (sólido, sem mexer).
- UI de permissões (já funcional via `UserPermissionsTab`).
- Timezone multi-região (continua fixo `America/Sao_Paulo`).

### Próximo passo
Confirme **"Aplicar correções"** e eu implemento os 4 fixes + crio o cron job.
