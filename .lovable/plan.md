

## Plano: corrigir Telefonia (3CPlus) — 2 problemas

### Problema 1 — Grupo de Intervalos aparece ao abrir a campanha

O usuário foi explícito: **"Grupo de Intervalos" só deve aparecer no formulário de criação**. Hoje o painel expandido (`CampaignsPanel.tsx`, linhas 469-491) mostra de novo o seletor + botão "Salvar" — daí a sensação de que "não foi salvo".

Causa adicional do "parece vazio": o GET `/campaigns/{id}` retorna o grupo aninhado em `dialer_settings.work_break_group_id` (ou objeto `work_break_group.id`), mas o leitor em `loadCampaigns` só preenche o `campaignWBG[cid]` se algum desses campos existir — e como o seletor é exibido vazio quando a leitura falha, o operador acha que não persistiu.

**Correção:**
1. **Remover totalmente o bloco "Grupo de Intervalos"** do detalhe expandido (`CampaignsPanel.tsx` linhas 469-491). Junto, remover:
   - `handleSaveWorkBreakGroup` (linhas 216-231)
   - states `campaignWBG` / `savingWBG` (linhas 52-53)
   - mapeamento `wbgMap` em `loadCampaigns` (linhas 124-133)
   - import `Coffee` se não usado em outro lugar
2. Manter o seletor **apenas** no diálogo "Nova Campanha" (já existe — `selectedWorkBreakGroup`).
3. Manter no `threecplus-proxy` o envio aninhado `dialer_settings.work_break_group_id` no `create_campaign` (já está correto desde a última rodada).

### Problema 2 — Métricas continuam zeradas mesmo clicando "Atualizar Detalhes"

Logs do edge function provam a causa raiz:
```
campaign_lists_total_metrics → 422
campaign_lists_metrics       → 422
```

Esses dois endpoints (`/campaigns/{id}/lists/total_metrics` e `/lists/metrics`) **só funcionam quando a campanha tem mailing carregado**. A campanha 257548 ("13.04 Recentes jun-mar") foi criada agora e ainda não tem lista alimentada → 422 Unprocessable → `campaignMetrics[cid]` fica `{}` → todos os cards mostram 0.

A 3CPlus expõe um endpoint mais geral que **funciona mesmo sem mailing**: `GET /campaigns/{id}/statistics?startDate=...&endDate=...` (já existe como `campaign_statistics` no proxy, linhas 267-274, mas **não está sendo chamado** no `loadCampaignDetails`). Ele retorna `total_dialed`, `answered`, `abandoned`, `asr`, `average_talk_time`, `in_queue`, `completed`, `no_answer` — exatamente os campos que o card "Visão Geral" tenta ler.

**Correção:**
1. Em `loadCampaignDetails` (`CampaignsPanel.tsx` linhas 144-168): adicionar chamada paralela a `campaign_statistics` com `startDate=hoje 00:00:00` e `endDate=hoje 23:59:59`. Usar `extractObject` no resultado para popular `campaignMetrics[cid]`.
2. Manter `campaign_lists_total_metrics` como fallback (quando houver mailing, ele dá números mais granulares por lista). Se `campaign_statistics` falhar, cair no `total_metrics`. Se ambos falharem, mostrar zero (comportamento atual).
3. No `threecplus-proxy` (linha 267): silenciar 422 — quando `lists/total_metrics` ou `lists/metrics` retornarem 422, devolver `{ data: {}, success: false, no_mailing: true }` em vez de propagar erro, para evitar ruído no console.
4. Adicionar logs no proxy: imprimir os primeiros 300 chars da resposta de `campaign_statistics` para validar o shape real do tenant.

### Arquivos alterados

- `src/components/contact-center/threecplus/CampaignsPanel.tsx`
  - Remover bloco "Grupo de Intervalos" do detalhe expandido + handlers/states associados.
  - Adicionar `campaign_statistics` à lista de Promises em `loadCampaignDetails`.
  - Priorizar `campaign_statistics` ao montar `campaignMetrics[cid]`; fallback para `campaign_lists_total_metrics`.
- `supabase/functions/threecplus-proxy/index.ts`
  - Tratar 422 em `campaign_lists_total_metrics` / `campaign_lists_metrics` como "sem mailing" (resposta silenciosa).
  - Adicionar log do shape de `campaign_statistics` para diagnóstico.

### Validação pós-deploy

1. Abrir campanha existente → **não** aparece mais o seletor "Grupo de Intervalos" no detalhe expandido. Só "Webhook Bidirecional" + abas.
2. Criar nova campanha selecionando um Grupo → criada com sucesso (já estava funcionando no proxy).
3. Métricas "Total Discado / Atendidas / ASR / Tempo Médio / Na Fila / etc." passam a refletir os números reais da 3CPlus, atualizando a cada 15s automaticamente — mesmo em campanhas sem mailing carregado (vai mostrar 0 legítimo, não 0 por erro).

### Fora de escopo

- Mexer no fluxo de chamada/pausa do operador.
- Adicionar histórico/gráficos das métricas (só estamos consertando o snapshot atual).

