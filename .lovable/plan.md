
## Finalização da UI: Agendamento + Recorrência

Backend e serviço já operacionais. Falta plugar a UI nos 2 pontos de consumo.

### 1. `WhatsAppBulkDialog.tsx` — UI de agendamento no AlertDialog

No AlertDialog de confirmação (W2.1), adicionar bloco de agendamento acima dos botões:

- **Toggle de 3 modos** (Tabs): `Enviar agora` | `Agendar uma vez` | `Recorrente`.
- **Estado local:**
  - `scheduleMode: 'now' | 'once' | 'recurring'` (default `'now'`)
  - `scheduledDate: Date | undefined`
  - `scheduledTime: string` (HH:MM, default `08:00`)
  - `recurrenceRule: RecurrenceRule` (default: diária, 08:00, janela 08–20, skip_weekends=true)

- **Modo "Agendar uma vez":**
  - Shadcn DatePicker (com `pointer-events-auto`) + `<Input type="time">`.
  - Validação: combinação data+hora ≥ agora+5min e ≤ agora+30d.
  - Banner amarelo se hora < 08:00 ou > 20:00.

- **Modo "Recorrente":**
  - Usa `<RecurrenceRuleEditor value={recurrenceRule} onChange={...} />` já criado.

- **Botão de ação dinâmico:**
  - `now` → "Confirmar e Enviar" (chama `handleSend` atual).
  - `once` → "Agendar Disparo" (chama `handleSend` passando `scheduled_for: ISO`, `schedule_type:'once'`).
  - `recurring` → "Agendar Recorrência" (passa `schedule_type:'recurring'`, `recurrence_rule`, e `scheduled_for` = próxima ocorrência calculada via `computeNextRunClient`).

- **`handleSend`** passa a receber opções de agendamento e repassa para `createCampaign`. Se `schedule_type !== undefined`, não chama `startCampaign`. Toast final ajustado: "Agendado para DD/MM HH:mm".

### 2. `CampaignManagementPage.tsx` — gestão de agendadas

- **Novo chip no filtro de status:** `Agendadas` (busca `status='scheduled'`). Sub-toggle interno: `Todas | Uma vez | Recorrente` (filtra por `schedule_type`).
- **Card de campanha agendada:**
  - One-shot: badge azul "Agendada" + "Dispara em `<countdown>`" (ex: "em 2h 15min" usando `date-fns/formatDistanceToNow`).
  - Recorrente: badge roxa "Recorrente" + linha descritiva (via `describeRecurrenceRule` do `RecurrenceRuleEditor`) + "Próxima: DD/MM HH:mm" + "`run_count` / `max_runs ?? ∞` execuções".
- **Menu de ações** (DropdownMenu, gated por `permissions.canCreateCampanhas`):
  - `Disparar agora` → `fireNowScheduledCampaign(id)`.
  - `Cancelar agendamento` (one-shot) → `cancelScheduledCampaign(id)` com AlertDialog de confirmação.
  - `Pausar` / `Retomar` (recorrente) → `pauseRecurringCampaign(id)` / `resumeRecurringCampaign(id)`.
  - `Editar regra` (recorrente) → abre modal pequeno com `<RecurrenceRuleEditor>` + salva via `updateRecurrenceRule(id, newRule)`.
  - `Ver execuções` (recorrente) → Dialog lista `whatsapp_campaign_runs` filtrado por `parent_campaign_id` (data, status, destinatários, link pro child).
- **Invalidação de query** após cada ação para refresh imediato.

### 3. Ajustes de apoio

- `campaignManagementService.ts` — garantir que `fetchCampaigns` retorna os campos novos (`scheduled_for`, `schedule_type`, `recurrence_rule`, `recurrence_run_count`, `parent_campaign_id`). Provavelmente `select('*')` já pega; só confirmar types.
- Adicionar helper `fetchCampaignRuns(parentId)` no service lendo `whatsapp_campaign_runs`.

### Arquivos alterados
1. `src/components/carteira/WhatsAppBulkDialog.tsx`
2. `src/components/contact-center/whatsapp/campaigns/CampaignManagementPage.tsx`
3. `src/services/campaignManagementService.ts` (helper de runs + types)

### Fora de escopo
- Backend (já pronto).
- `send-bulk-whatsapp` (intocado).
- Timezone multi-região (fixo `America/Sao_Paulo`).
