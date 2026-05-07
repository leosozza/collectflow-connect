## Objetivo

Permitir Pausar, Retomar e Cancelar campanhas que já estão em disparo (status `sending`) — hoje essas ações existem apenas para campanhas recorrentes agendadas. Manter o visual atual (mesma tabela, mesmo menu de 3 pontinhos), só ampliando quando ele aparece e quais ações mostra.

## O que muda na UI (CampaignManagementTab.tsx)

Localização: aba **Contact Center → WhatsApp → Campanhas** (mesma tela do print). Sem mudar layout, cores ou estrutura — só comportamento do menu `MoreVertical` que já existe na coluna final.

1. Tornar o menu de ações visível também quando `status` for `sending` (hoje só aparece para `scheduled`/`paused`).
2. Itens do menu por estado:
   - `sending` → **Pausar disparo** (Pause), **Cancelar campanha** (X, em vermelho)
   - `paused` (não-recorrente, com envios pendentes) → **Retomar disparo** (Play), **Cancelar campanha**
   - `scheduled`/`paused` recorrente → mantém exatamente o que já existe (Disparar agora, Pausar/Retomar recorrência, Editar regra, Ver execuções, Cancelar)
3. Reaproveitar o `AlertDialog` já existente para confirmar Cancelar (texto adaptado quando a campanha está em execução: "Os envios em andamento serão interrompidos e os destinatários pendentes marcados como cancelados").
4. Pausar/Retomar disparo funcionam direto no clique com `toast.success`/`toast.error` (sem dialog), igual ao padrão atual de Pausar/Retomar recorrência.
5. Sem nova tela: o usuário continua acessando os detalhes clicando na linha, como hoje. (Se quiser, podemos no futuro repetir os mesmos botões dentro de `CampaignDetailView` — fora do escopo desta tarefa para não mexer no visual da detalhada.)

## O que muda no service (src/services/whatsappCampaignService.ts)

Adicionar 3 funções novas, sem alterar as existentes (que são específicas de recorrência/agendamento):

- `pauseSendingCampaign(id)` → `update({ status: "paused" }).eq("id", id).eq("status", "sending")`
- `resumeSendingCampaign(id)` → muda `status` de `paused` → `sending` e dispara `send-bulk-whatsapp` via `supabase.functions.invoke` com `{ campaign_id }` para o worker retomar de onde parou.
- `cancelSendingCampaign(id)` → marca campanha como `cancelled` e atualiza recipients `pending`/`processing` para `cancelled` (mesma lógica do `cancelScheduledCampaign`, mas aceitando `sending`/`paused`).

Alternativa mais simples: estender `cancelScheduledCampaign` para aceitar `sending` no `.in("status", [...])` e renomear semanticamente — escolhi manter funções separadas para deixar claro o caso de uso.

## O que muda no worker (supabase/functions/send-bulk-whatsapp/index.ts)

O worker hoje processa em loop sem checar se a campanha foi pausada/cancelada. Adicionar checagem leve:

1. A cada N iterações do `while (true)` (ou no início de cada ciclo round-robin de instâncias), reler `whatsapp_campaigns.status` da campanha atual.
2. Se `status === "paused"` ou `status === "cancelled"`:
   - Resetar recipients `processing` deste worker de volta para `pending` (no caso de paused) ou para `cancelled` (no caso de cancelled).
   - Liberar o lock via `release_campaign_lock`.
   - Sair do loop sem auto-retrigger.
3. No caminho de finalização normal, se o status for `cancelled`, não sobrescrever para `completed`.

Isso garante que clicar em "Pausar" interrompe os envios em até alguns segundos, e "Retomar" reinvoca o worker que continua de onde parou (a lógica de claim atômico de recipients pending já suporta isso).

## Arquivos afetados

- `src/components/contact-center/whatsapp/CampaignManagementTab.tsx` — ampliar visibilidade do menu, adicionar handlers `handlePauseSending`, `handleResumeSending`, ajustar texto do dialog de cancelar.
- `src/services/whatsappCampaignService.ts` — 3 funções novas.
- `supabase/functions/send-bulk-whatsapp/index.ts` — checagem periódica de status no loop principal + tratamento de saída por pause/cancel.

## Fora do escopo

- Mudanças no visual/cores/layout da tela.
- Botões dentro de `CampaignDetailView` (pode ser um próximo passo se desejado).
- Métricas/relatórios sobre campanhas pausadas.
