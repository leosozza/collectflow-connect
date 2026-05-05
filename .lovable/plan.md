
## Objetivo

Deixar o **Histórico de Atendimento** legível para o operador final: zero tecnicismo, zero "Origem desconhecida", zero UUID cru, zero ruído de mensagens individuais de WhatsApp — e devolver os botões de filtro no topo. Sem quebrar timelines existentes nem inserts atuais.

---

## 1) Eliminar ruído de WhatsApp na timeline

**Hoje**: cada mensagem WhatsApp vira um card `WhatsApp Enviado` / `WhatsApp Recebido` (vindo do trigger `trg_client_event_from_chat_message`). Isso polui o histórico — o canal WhatsApp já tem aba própria.

**Mudança (somente UI, sem mexer no banco)**:
- Em `ClientTimeline.tsx`, **filtrar fora** os eventos `whatsapp_inbound` e `whatsapp_outbound` na construção de `items`.
- Em vez disso, agrupar conversas usando os eventos já existentes:
  - `atendimento_opened` → "Cliente iniciou conversa com **{operador}**" (ou "**{operador}** iniciou atendimento via WhatsApp" quando `origin_actor=operator`).
  - `atendimento_closed` → "Atendimento encerrado por **{operador}**".
  - `conversation_auto_closed` → "Conversa encerrada automaticamente pelo sistema (inatividade)".
  - `conversation_transferred` → "Conversa transferida de **{de}** para **{para}**".

**Resiliência**: para conversas antigas sem `atendimento_opened`/`closed`, sintetizar **um único card por janela de WhatsApp** agrupando inbound+outbound contíguos (gap > 30 min ou troca de direção encerra) — exibido como "Conversa por WhatsApp ({n} mensagens)" com hora de início e fim, sem rótulo de "operador desconhecido". Eventos WhatsApp brutos seguem disponíveis no DB para auditoria; só somem da UI.

---

## 2) Acabar com "Origem desconhecida"

**Hoje**: `resolveActor` retorna `unknown` quando não acha `operator_id`/`created_by`. Mas vários eventos trazem o ator em outros campos (`event_source`, `metadata.source`, `metadata.actor`, `auto_disposition`, etc.).

**Mudança em `resolveActor`**:
- Adicionar fallbacks por **`event_source`** sempre que nada melhor for resolvido: `maxlist` → "Importação MaxList", `import` → "Importação", `api` → "API Externa", `manual` → "Edição Manual no Cadastro", `negociarie`/`asaas`/`boleto` → gateway, `auto_disposition` → "Sistema (regra automática)", `prevention` → "Régua de Prevenção", `workflow` → "Fluxo Automático", `regua` → "Régua de Cobrança", `ai_agent`/`ai` → "Agente IA".
- Para `field_update` vindo do **cadastro manual**, resolver pelo `auth.uid()` salvo em `metadata.updated_by` **ou** pelo cabeçalho `user_id` do RLS (já consultado via `profileMap`). Se mesmo assim faltar nome, exibir "Operador" (com `kind:user`) — nunca "desconhecida".
- **Garantia última**: o ramo `unknown` no fim só dispara se **não tivermos nenhum sinal**, e nesse caso mostramos "**Sistema**" (nunca "Origem desconhecida").

**Backend complementar (opcional, baixo risco)**: ajustar `trg_client_event_from_update_log` para preencher `metadata.actor_label` quando `auth.uid()` resolver para um `profiles.full_name` — assim toda alteração manual já chega rotulada. Sem alterar payload existente, só **adiciona** chave nova.

---

## 3) `field_update` legível (sem UUID/sem nome técnico)

**Hoje**: `tipo_divida_id: — → fdda7e09-…`.

**Mudança em `FieldUpdateDetail`**:
- **Lista de blacklist**: campos puramente técnicos não viram card (`updated_at`, `external_id`, `tenant_id`, `operator_id`, `status_cobranca_locked_*`, `propensity_score`, `enrichment_data`, `score_*`). Se a alteração só toca esses campos → o evento é **descartado** silenciosamente da UI.
- **Resolver IDs em rótulo humano** com queries leves cacheadas no componente:
  - `tipo_divida_id` → `debt_types.name`
  - `tipo_devedor_id` → `tipos_devedores.name`
  - `status_cobranca_id` → `status_cobrancas.name`
  - `meio_pagamento_id` → `payment_methods.name`
  - `operator_id` → `profiles.full_name`
- **Rótulos de campo PT-BR ampliados** em `FIELD_LABELS` (ex.: `tipo_divida_id` → "Tipo de Dívida", `tipo_devedor_id` → "Perfil do Devedor (cadastro)", `meio_pagamento_id` → "Meio de Pagamento").
- Valores `null/""/—` exibidos como "(vazio)" em vez de `—` ambíguo.
- Datas (`data_*`) formatadas pt-BR; valores monetários (`valor_*`) via `formatCurrency`.

Resultado: `Tipo de Dívida: (vazio) → Cartão de Crédito` por **Importação MaxList**.

---

## 4) Perfil do Devedor & Tabulação completos

**Perfil do Devedor (`debtor_profile_changed`)**:
- Detalhe passa a mostrar: `Ocasional → Resistente` (resolvendo via `PROFILES` de `DebtorProfileBadge`).
- Ator: usa `event_source` (`operator` → operador resolvido; `auto_disposition` → "Sistema (inferido pela tabulação **{disposition}**)").

**Disposição (`disposition`)**:
- Título permanece com o rótulo PT-BR (`DISPOSITION_TYPES`).
- Detalhe passa a incluir: `"{notas}"` quando houver, e sempre **"Tabulado por {operador}"** + canal (`event_channel`). Quando `metadata.scheduled_callback` existir → "Retorno agendado para {data formatada}".
- `resolveActor` para `disposition` prioriza `metadata.operator_id` (já existe) — se faltar, "Operador" em vez de unknown.

---

## 5) Restaurar a barra de filtros no topo (regressão do commit `31d91d07`)

A barra de chips/toggles **Acordo / Manual / Automático / Lote / 👍 / 👎** existia antes e foi apagada na correção de WhatsApp. Vamos recriar **dentro de `ClientTimeline.tsx`** (não em outro arquivo, para não criar dependência nova) com `useMemo`:

- Estado local `filters` com chaves: `acordo`, `manual`, `automatico`, `lote`, `positivas`, `negativas`. Default: todos ligados.
- Mapeamento → `event_type`:
  - **Acordo**: `agreement_*`, `payment_confirmed`, `manual_payment_*`, `previous_agreement_credit_applied`.
  - **Manual** (ações humanas): `disposition`, `note`, `observation_added`, `debtor_profile_changed` (quando `event_source=operator`), `field_update` (quando `event_source` ∈ manual/api), `atendimento_opened/closed` por operador.
  - **Automático** (sistema/IA/workflow/régua): `message_sent`, `conversation_auto_closed`, `agreement_overdue`, `agreement_status_completed`, `ai_*`, `portal_*`, `field_update` (maxlist/import/negociarie/asaas), `debtor_profile_changed` (auto_disposition).
  - **Lote**: eventos com `metadata.batch_id` ou `event_source ∈ {maxlist, import, prevention, regua}` (importações em massa, régua disparando para muitos clientes).
  - **Positivas / Negativas**: usa `DISPOSITION_TYPES[code].sentiment` (já existe). Vale para `disposition` e para `manual_payment_confirmed` (positiva) / `_rejected` (negativa).
- Visual: chips arredondados com cor da categoria (verde, azul, roxo, laranja) + 👍/👎 — replicando o screenshot enviado.
- **Estado vazio** quando todos desligados: "Nenhum filtro ativo — selecione ao menos uma categoria."

---

## 6) Sanidade & não-regressão

- Nada de mexer em RLS, nada de remover dados — apenas **filtra/transforma na UI** e adiciona rotulagem.
- Dispositions e agreements vindos por props (fallback quando `client_events` está vazio) seguem funcionando.
- Audio inline, gravação de ligação, `manual_payment_*`, signature etc. permanecem inalterados.
- Migration **opcional** (item 2): trigger ganha 1 chave a mais no metadata; backfill não é necessário (fallback do front cobre eventos antigos).

---

## Detalhes técnicos (referência)

### Arquivos tocados
- `src/components/atendimento/ClientTimeline.tsx` (núcleo: filtros + transformações + agrupamento WhatsApp + resolveActor + FieldUpdateDetail).
- `supabase/migrations/<novo>.sql` (apenas se aplicarmos o item 2 backend — adiciona `actor_label` ao `trg_client_event_from_update_log`).

### Queries adicionais (cacheadas via React Query)
- `debt_types(id,name)`, `tipos_devedores(id,name)`, `status_cobrancas(id,name)`, `payment_methods(id,name)` — chamadas só quando `field_update` referenciar esses IDs.

### Mapa de filtros (visualização)
```text
chip          color       inclui event_type
-----------------------------------------------------------------
Acordo        emerald     agreement_* / payment_confirmed / manual_payment_*
Manual        blue        disposition / note / observation_added / atendimento_* (operador)
Automático    purple      message_sent / *_auto_closed / agreement_overdue / ai_* / portal_*
Lote          orange      qualquer com metadata.batch_id OU source maxlist/import/prevention
👍 Positivas  green       disposition.sentiment=positive / manual_payment_confirmed
👎 Negativas  rose        disposition.sentiment=negative / manual_payment_rejected
```

---

## Aceite (como você valida)

1. Recarregar `/carteira/44653594899?tab=historico`:
   - Não aparecem mais 8 cards "WhatsApp Enviado/Recebido". Em vez disso, no máximo 1–2 cards "Conversa por WhatsApp" + os `atendimento_opened/closed` quando existirem.
   - "Acordo Criado" continua igual.
   - "Perfil do Devedor Atualizado" mostra "Ocasional" como destino e o operador (ou "Sistema (inferido pela tabulação …)" quando aplicável).
   - "Alteração de Dados" do `tipo_divida_id` aparece como "Tipo de Dívida: (vazio) → {nome do tipo}" com ator "Importação MaxList".
2. Nenhum card exibe "Origem desconhecida".
3. No topo da timeline aparecem os chips **Acordo / Manual / Automático / Lote / 👍 / 👎** e desligar cada um filtra corretamente.
4. Nenhum dado é perdido: queries diretas em `client_events` continuam vendo tudo (apenas a UI esconde ruído e renderiza melhor).
