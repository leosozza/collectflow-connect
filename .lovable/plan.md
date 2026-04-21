
## Implementação W2.1 + W2.2 + W2.3

Escopo restrito a 3 melhorias do bloco WhatsApp/Campanhas. Não altero Edge Functions — o backend já grava `progress_metadata` com `last_chunk_at`, `batch_resting` e `resting_instance`, então o ETA é calculado no frontend.

---

### W2.1 — AlertDialog de confirmação antes de disparar (bloqueante)

**Arquivo:** `src/components/carteira/WhatsAppBulkDialog.tsx`

Hoje o Step 3 ("Revisar") já mostra resumo + estimativa, e o botão "Iniciar Disparo" chama `startCampaign` direto. Vou adicionar uma camada extra de confirmação obrigatória.

- Novo estado `confirmStartOpen: boolean`.
- O botão "Iniciar Disparo" do Step 3 passa a abrir o `AlertDialog` em vez de disparar.
- O `AlertDialog` mostra:
  - **Nome da campanha** (input novo, opcional — default `Disparo carteira HH:mm`)
  - **Total de destinatários únicos** (`dedup.recipients.length`)
  - **Instâncias selecionadas** (lista compacta com nome)
  - **Modo** (Oficial Meta vs Anti-Ban Não-Oficial)
  - **Tempo estimado** (já calculado por `estimateTimeMinutes`)
  - **Aviso vermelho:** "Após iniciar, o disparo não pode ser interrompido pelo painel. Mensagens já enviadas não podem ser revertidas."
- Botões: **Cancelar** (autoFocus, fecha diálogo, mantém Step 3) / **Confirmar e Iniciar**.
- `onOpenChange` e `onEscapeKeyDown` bloqueados enquanto `sending===true`.
- Padrão idêntico ao da Fase 2 (acordos), garantindo consistência de UX.

---

### W2.2 — Pré-visualização de template renderizado com destinatário real

**Arquivo:** `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx`

Adicionar botão "Pré-visualizar mensagem" no card "Mensagem" (já existe nas linhas 202-214).

- Ao clicar, abre `Dialog` com:
  - Seletor de destinatário (default: 1 aleatório dos primeiros 50 da campanha — query leve em `whatsapp_campaign_recipients` filtrando pela `campaign_id`, selecionando `representative_client_id, recipient_name, phone, message_body_snapshot`).
  - Bolha de chat estilo WhatsApp (verde claro, alinhada à direita, com timestamp).
  - Se `message_body_snapshot` existir, renderiza ele direto (já vem com placeholders resolvidos pelo backend no momento do envio — ou texto bruto se ainda for `pending`).
  - Se for `pending`, busca dados do cliente em `client_profiles` (nome, valor da próxima parcela, vencimento, credor) e aplica resolução local usando o mesmo padrão de `template-resolver.ts` (`{{nome}}`, `{{cpf}}`, `{{valor_parcela}}`, `{{data_vencimento}}`, `{{credor}}`, `{{valor}}` alias).
  - Botão "Sortear outro destinatário" para re-selecionar aleatoriamente.
- Helper local `resolveTemplateClient(message: string, client)` no service `whatsappCampaignService.ts` (espelho do `_shared/template-resolver.ts`, sem dependência de Edge).

---

### W2.3 — Indicador de rate-limit (anti-ban) ativo

**Arquivos:**
- `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx` (exibição)
- `src/services/campaignManagementService.ts` (já retorna `progress_metadata` via `fetchCampaignDetail`)

Quando `campaign.status === "sending"`, calcular e mostrar painel ao vivo:

- Ler `progress_metadata.last_chunk_at` e `progress_metadata.batch_resting`.
- Constantes do frontend (espelham o Edge):
  - Não-oficial: 8-15s entre envios, 120s rest a cada 15.
  - Oficial: 1-3s entre envios, 30s rest a cada 50.
- Calcular `nextSendIn = max(0, expectedDelayMs - (now - last_chunk_at))`.
- Card destacado:
  - Se `batch_resting`: `"Pausa anti-ban ativa em {resting_instance} — retomando em XX s"` (countdown ao vivo, badge laranja).
  - Senão: `"Próximo envio em ~XX s"` (badge verde).
- `useEffect` com `setInterval(1000)` para atualizar countdown; `useQuery` com `refetchInterval: 5000` para atualizar `progress_metadata`.
- Some quando `status !== "sending"`.

---

### Arquivos alterados

1. `src/components/carteira/WhatsAppBulkDialog.tsx` — AlertDialog de confirmação (W2.1)
2. `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx` — botão preview + painel rate-limit (W2.2 + W2.3)
3. `src/services/whatsappCampaignService.ts` — helper `resolveTemplateClient` (W2.2)
4. `src/services/campaignManagementService.ts` — só conferir que `progress_metadata` está sendo retornado (provavelmente já está; ajuste mínimo se faltar)

### Fora de escopo
- Edge Functions (não mexo no `send-bulk-whatsapp`).
- Pausar/cancelar campanha em andamento.
- Notificações sonoras ou push.

### Próximo passo
Aplicar os 3 itens em sequência e validar lendo o código depois.
