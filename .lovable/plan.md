
## Auditoria final — bugs encontrados antes de liberar uso

### ✅ Validado e funcionando
- **Cron job**: `wa-campaign-scheduler` está **ativo** (jobid 13), rodando a cada 1 min.
- **Schema**: todas as colunas (`scheduled_for`, `schedule_type`, `recurrence_rule`, `recurrence_run_count`, `parent_campaign_id`, `instance_weights`) presentes.
- **Edge function**: respondendo 200 OK, scan=0 (nada pendente, esperado).
- **Tabela `whatsapp_campaign_runs`**: criada com RLS correta (tenant + service_role).
- **Lock atômico anti-race**: aplicado corretamente na recorrência.
- **Anti-ban + distribuição round-robin/weighted**: sólidos, sem mexer.

---

### 🔴 Bug 1 (CRÍTICO) — Campanhas agendadas **não terão destinatários**

**Onde:** `WhatsAppBulkDialog.tsx` linhas 427–439.

**O que acontece:** quando `scheduleMode !== "now"`, o código chama `createRecipients(...)` **mas em seguida faz `onClose()` e retorna**. Só que o problema real é outro: em `createCampaign`, o status inicial é `"scheduled"` e o UI até aqui está OK. Porém, quando o cron roda e a função `dispatchRecurring` é chamada, ela clona os **recipients da mãe** (linhas 203–208 do edge). Isso funciona. ✅

Porém, em `dispatchOneShot`, o status pula direto para `"sending"` e invoca `send-bulk-whatsapp`. OK, também funciona.

**Mas** — verifiquei em detalhe: o fluxo está correto. Retiro este bug. Na verdade não há falha aqui. ✅

### 🔴 Bug 1 REAL — `day_of_month` até 28 corta dias 29–31

**Onde:** `whatsappCampaignService.ts:566` e `dispatch-scheduled-campaigns/index.ts:66`.

```ts
const dom = Math.min(Math.max(rule.day_of_month || 1, 1), 28);
```

Se o usuário escolher recorrência mensal no dia 30, o sistema silenciosamente troca para dia 28 sem avisar. Em vez disso, se o dia não existir no mês (ex.: 30 de fevereiro), deve cair no **último dia do mês**.

**Fix:** permitir 1–31 no input e, no cálculo, quando o mês não tiver o dia, disparar no último dia disponível (`min(day_of_month, daysInMonth)`).

### 🔴 Bug 2 — Edge descarta campanhas agendadas sem `tenant_id` no audit

**Onde:** `dispatch-scheduled-campaigns/index.ts:105-113` e 156-164.

O insert em `audit_logs` usa `user_id: campaign.created_by`. Se `created_by` for `null` (ex.: campanha criada por automação antiga), o insert falha e derruba o dispatch. Além disso, a tabela `audit_logs` provavelmente tem RLS/NOT NULL que pode rejeitar. Precisa envolver em `try/catch` — a auditoria não pode bloquear o disparo.

**Fix:** envolver todos os `insert` em `audit_logs` e `whatsapp_campaign_runs` em `try/catch` que loga mas não propaga erro.

### 🟠 Bug 3 — Campanha filha (child) herda `provider_category`, mas perde `routing_mode`

**Onde:** `dispatch-scheduled-campaigns/index.ts:220-244` (insert do child).

Ao clonar a campanha-mãe na recorrência, o código copia `instance_weights` mas **não copia `routing_mode`**. Se a mãe estava em modo `weighted`, a filha vira o default e ignora os pesos. Isso afeta a distribuição.

**Fix:** adicionar `routing_mode: mother.routing_mode` ao insert do child.

### 🟡 Alerta 1 — Window check compara strings, não horários

**Onde:** `dispatch-scheduled-campaigns/index.ts:191`.

```ts
if (hhmm < rule.window_start || hhmm > rule.window_end) { ... }
```

Comparação lexicográfica de strings `"HH:MM"` funciona **só** enquanto o formato é rígido (2 dígitos sempre). Como o editor produz `HH:MM` padronizado, funciona hoje, mas é frágil. Não bloqueia uso — mantenho como está e adiciono comentário.

### 🟡 Alerta 2 — `AlertDialogDescription` ainda contém só texto, mas o conteúdo interativo está em `<div>` irmão **fora** do `<AlertDialogHeader>`. Acessibilidade OK. ✅ Corrigido na iteração anterior.

---

### Arquivos a alterar

1. **`supabase/functions/dispatch-scheduled-campaigns/index.ts`**
   - Fix day_of_month → usa último dia do mês quando o mês não tem o dia escolhido.
   - Envolver `audit_logs.insert` e `whatsapp_campaign_runs.insert` em `try/catch`.
   - Copiar `routing_mode` da mãe para a filha.
   - Adicionar comentário na window check.

2. **`src/services/whatsappCampaignService.ts`**
   - Mesmo fix de `day_of_month` em `computeNextRunClient` (mirror do edge).

3. **`src/components/carteira/RecurrenceRuleEditor.tsx`** (verificar — provavelmente limita a 28 no UI)
   - Permitir 1–31 no seletor mensal + tooltip: "Meses sem o dia usam o último dia disponível".

### Fora de escopo
- Anti-ban (sólido).
- UI de `CampaignManagementTab` (filtros e controles funcionais).
- Integração `send-bulk-whatsapp` (intocado).

### Veredito

**O sistema está usável agora para agendamentos diários, semanais e mensais até dia 28.** As 3 correções acima são refinamentos de robustez que evitam bugs em casos específicos (dia 29–31, recorrência com distribuição por peso, falha silenciosa em audit). Após elas, o módulo está pronto para produção.

Confirme **"Aplicar correções finais"** e implemento os 3 fixes.
