
## Plano: Agendamento de Disparos (one-shot + recorrente)

Inclui tudo do plano anterior + **recorrência** (diária/semanal/mensal) pensada para tenants que operam com Agente de IA 24/7.

---

### C.1 Banco — colunas + status + tabela de recorrência

**Migration em `whatsapp_campaigns`:**
- `scheduled_for timestamptz` (nullable) — próxima execução.
- `schedule_type text` — `'once' | 'recurring'` (default `'once'`).
- `recurrence_rule jsonb` (nullable) — regra da recorrência. Ex.:
  ```json
  {
    "frequency": "daily" | "weekly" | "monthly",
    "time": "08:00",
    "weekdays": [1,2,3,4,5],      // se weekly
    "day_of_month": 10,            // se monthly
    "window_start": "08:00",       // janela de envio permitida
    "window_end": "20:00",
    "end_at": "2026-12-31T23:59:59Z" | null,
    "max_runs": 30 | null,
    "skip_weekends": true,
    "timezone": "America/Sao_Paulo"
  }
  ```
- `recurrence_run_count int default 0` — quantas execuções já rodaram.
- `parent_campaign_id uuid` (nullable) — FK para campanha "mãe" (instâncias filhas geradas a cada execução).
- Novo valor de `status`: `'scheduled'`.
- Índice parcial: `WHERE status = 'scheduled'`.

**Tabela nova `whatsapp_campaign_runs`** (histórico de execuções da recorrente):
- `id, parent_campaign_id, child_campaign_id, run_at, status, recipients_count, tenant_id`.
- RLS padrão por tenant.

---

### C.2 UI — agendamento no AlertDialog de confirmação

Em `WhatsAppBulkDialog.tsx`, expandir o AlertDialog W2.1:

**Toggle principal:** Enviar agora | Agendar uma vez | Recorrente

**Agendar uma vez:**
- DatePicker (shadcn) + input de hora.
- Validação: mínimo +5 min, máximo +30 dias.
- Banner amarelo se hora fora de 08h–20h.

**Recorrente:**
- Frequência: Diária | Semanal | Mensal.
- Horário do disparo (ex.: 08:00).
- Se Semanal: checkboxes dos dias da semana.
- Se Mensal: seletor de dia do mês (1–28 para evitar meses curtos).
- Janela de envio permitida (default 08:00–20:00).
- Toggle "Pular fins de semana".
- Término: Nunca | Em data | Após N execuções.
- Preview textual: "Vai rodar toda segunda e quarta às 08:00, até 31/12/2026 (aprox. 70 execuções)."

Botão muda conforme modo: **Criar e Enviar / Agendar Disparo / Agendar Recorrência**.

---

### C.3 Serviço — criação

`whatsappCampaignService.ts`:
- `createCampaign` aceita `scheduled_for?`, `schedule_type?`, `recurrence_rule?`.
- Se agendada (one-shot ou recorrente): status inicial `'scheduled'`, **não** chama `startCampaign`.
- Funções novas:
  - `cancelScheduledCampaign(id)` — muda para `'cancelled'` + recipients `pending`→`cancelled`.
  - `rescheduleCampaign(id, newDate)`.
  - `updateRecurrenceRule(id, newRule)`.
  - `fireNow(id)` — antecipa execução.

---

### C.4 Cron + Edge Function dispatcher

**`pg_cron` rodando a cada 1 min** chamando `dispatch-scheduled-campaigns`.

**Edge `dispatch-scheduled-campaigns`:**
1. Busca campanhas com `status='scheduled'` e `scheduled_for <= now()`.
2. Para **one-shot**: muda status para `'sending'` (atômico) e invoca `send-bulk-whatsapp`.
3. Para **recorrente**:
   - Valida `recurrence_rule` (janela, fins de semana, `end_at`, `max_runs`).
   - Se válida → **clona** a campanha (nova linha com `parent_campaign_id`, status `'sending'`, mesmos destinatários/filtros rematerializados a partir dos critérios originais salvos em `audience_metadata`) e invoca `send-bulk-whatsapp` na cópia.
   - Registra em `whatsapp_campaign_runs`.
   - Incrementa `recurrence_run_count` na mãe.
   - Atualiza `scheduled_for` da mãe para a **próxima ocorrência** calculada pela `recurrence_rule`.
   - Se `end_at` passou ou `run_count >= max_runs` → marca mãe como `'completed'` e remove do agendador.
4. Respeita `try_lock_campaign` existente.

---

### C.5 Gestão — listagem e controles

Em `CampaignManagementPage`:
- **Filtro novo "Agendadas"** + sub-filtro Uma vez / Recorrente.
- Card mostra:
  - One-shot: `scheduled_for` + countdown ("em 2h 15min").
  - Recorrente: regra em linguagem natural + próxima execução + contador `X de Y execuções`.
- Ações (admin/delegado):
  - **Cancelar agendamento** (one-shot).
  - **Pausar/Retomar recorrência** (status `'scheduled'` ↔ `'paused'`).
  - **Editar regra** (reabre dialog de agendamento).
  - **Disparar agora** (antecipa execução).
  - **Ver execuções** (modal com lista de `whatsapp_campaign_runs`).

---

### C.6 Auditoria

`audit_logs`:
- `scheduled_campaign_created`, `scheduled_campaign_cancelled`, `scheduled_campaign_triggered`.
- `recurring_campaign_created`, `recurring_campaign_paused`, `recurring_campaign_resumed`, `recurring_campaign_edited`, `recurring_run_executed`, `recurring_campaign_finished`.
- Metadata: quem fez a ação, regra antes/depois em edições.

---

### Arquivos alterados/criados

- **Migration SQL** — colunas em `whatsapp_campaigns`, tabela `whatsapp_campaign_runs`, índices, RLS, cron job.
- **Edge Function nova** — `supabase/functions/dispatch-scheduled-campaigns/index.ts` (inclui calculador de próxima ocorrência).
- `src/services/whatsappCampaignService.ts` — assinaturas novas + helpers de recorrência.
- `src/components/carteira/WhatsAppBulkDialog.tsx` — UI de agendar/recorrer no AlertDialog.
- `src/components/contact-center/whatsapp/campaigns/CampaignManagementPage.tsx` — filtros e controles.
- Componente novo `RecurrenceRuleEditor.tsx` (reutilizável para criação e edição).
- `src/integrations/supabase/types.ts` — automático via migration.

### Fora de escopo
- `send-bulk-whatsapp` (sem mudanças — consome campanhas `sending`).
- Anti-ban (já sólido).
- Timezone multi-região (fica fixo `America/Sao_Paulo` nesta entrega).

### Próximo passo
Confirme **"Aplicar agendamento + recorrência"** para implementar.
