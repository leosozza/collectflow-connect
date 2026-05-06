## Objetivo

Limpar o **Histórico do Cliente** seguindo a regra: só aparece WhatsApp quando o operador **aceitou** a conversa ou quando ela **foi encerrada** (por operador ou pelo sistema). E categorizar **disparo em massa de WhatsApp** como **Lote**, separando claramente do bate-papo humano.

---

## 1) Backend: trigger de `chat_messages` → `client_events` carrega contexto de campanha

Hoje o trigger `trg_client_event_from_chat_message` grava só `direction` + `status` no metadata. As mensagens de campanha (`send-bulk-whatsapp`) já gravam em `chat_messages.metadata`: `source_type='campaign'`, `campaign_id`, `instance_id`, `provider`. Precisamos propagar isso.

**Migração nova** (`supabase/migrations/<novo>.sql`) — recria a função `trg_client_event_from_chat_message`:
- Continua inserindo `whatsapp_inbound`/`whatsapp_outbound`.
- `event_source` passa a refletir a origem real:
  - `campaign` quando `chat_messages.metadata->>'source_type' = 'campaign'`
  - `regua`/`prevention` quando `metadata->>'source_type' IN ('workflow','prevention','regua')`
  - `operator` quando `is_internal = true`
  - `system` caso contrário (ex.: webhook recebido).
- Metadata acrescenta: `source_type`, `campaign_id`, `instance_id`, `provider` (quando existirem em `chat_messages.metadata`), além de `direction`/`status` que já existem.
- Sem backfill — eventos antigos seguem como estão; UI tem fallback.

Risco: trigger continua INSERT-only e não muda assinatura. RLS não é afetado.

---

## 2) UI: política de exibição de WhatsApp no histórico

Em `src/components/atendimento/ClientTimeline.tsx`, ajustar a construção de `items`:

**A. Eliminar o card sintético "Conversa por WhatsApp"** (hoje gerado a partir do agrupamento de inbound/outbound). O histórico passa a NÃO ter resumo automático de conversa.

**B. Exibir apenas os marcos da conversa**:
- `atendimento_opened` → "**{Operador}** aceitou conversa via WhatsApp" (quando `event_source=operator`) ou "Cliente iniciou conversa (WhatsApp)" (quando inbound iniciou e ainda não há operador).
- `atendimento_closed` → "Atendimento encerrado por **{Operador}**".
- `conversation_auto_closed` → "Conversa encerrada automaticamente (inatividade)".
- `conversation_transferred` → "Conversa transferida de **{de}** para **{para}**".

Esses marcos vão para a categoria **Manual** (quando o ator é o operador) ou **Automático** (quando é sistema/auto-close).

**C. Disparo em massa (campanha)** — agrupar `whatsapp_outbound` cujo `metadata.source_type='campaign'` em **um único card por `campaign_id`**:
- Título: "Disparo de WhatsApp em massa".
- Detalhe: nome da campanha (lookup leve em `whatsapp_campaigns.name` por `campaign_id`) + horário.
- Ator: "Campanha de WhatsApp" (kind: `system`).
- Categoria: **Lote**.
- Sentimento: neutro.

Eventos `whatsapp_outbound` com `source_type IN ('regua','prevention','workflow')` → card único agrupado por régua/dia: "Mensagem enviada pela Régua de Prevenção" → categoria **Automático**.

**D. Mensagens de bate-papo humano** (`whatsapp_inbound` e `whatsapp_outbound` sem `source_type`) → **descartadas da timeline**. Quem precisa do bate-papo abre a aba WhatsApp. Dados continuam no banco.

---

## 3) UI: categorização revisada (filtros do topo)

Atualizar `classifyEvent`:

```text
chip          inclui
-------------------------------------------------------------
Acordo        agreement_* / payment_confirmed / manual_payment_*
Manual        disposition / note / observation_added /
              atendimento_opened|closed (operador) /
              field_update (operador) /
              debtor_profile_changed (operador)
Automático    conversation_auto_closed / agreement_overdue /
              agreement_broken (auto) / message_sent (régua/workflow) /
              whatsapp_outbound (source régua/prevention/workflow) /
              field_update (negociarie/asaas/api/auto)
Lote          field_update (maxlist/import) /
              eventos com metadata.batch_id /
              whatsapp_outbound (source_type=campaign)
👍/👎        sentimento de disposition / manual_payment_*
```

Regra-chave: **um evento só pertence a UMA categoria** — Lote tem prioridade sobre Automático quando ambos se aplicam (ex.: campanha é lote, não automático).

---

## 4) Não-regressão

- Não mexe em RLS, não muda nenhum payload existente — apenas **acrescenta** chaves no metadata.
- `client_events` segue completo no banco; mudança é só de UI + enriquecimento do metadata.
- Aba WhatsApp e demais módulos não são tocados.

---

## Aceite

1. Em `/carteira/<cpf>?tab=historico`:
   - **Não aparecem** mensagens individuais de WhatsApp nem o card "Conversa por WhatsApp X mensagens".
   - Aparece "**Operador** aceitou conversa via WhatsApp" quando o operador aceitou e "Atendimento encerrado por **Operador**" / "Conversa encerrada automaticamente" no fim.
   - Disparo de campanha aparece como "Disparo de WhatsApp em massa — {nome}", chip **laranja (Lote)**.
2. Filtro **Lote** acende campanhas + importações MaxList; filtro **Automático** acende régua/auto-close/quebra automática.
3. Nenhum evento sai como "Origem desconhecida".

---

## Arquivos tocados

- `supabase/migrations/<novo>.sql` — recria `trg_client_event_from_chat_message` propagando `source_type`/`campaign_id`/`instance_id`/`provider`.
- `src/components/atendimento/ClientTimeline.tsx` — remove agrupamento sintético, adiciona agrupamento por campanha, ajusta `classifyEvent` e `resolveActor`, lookup leve em `whatsapp_campaigns(name)`.
