

Plano em 7 fases para evoluir o módulo WhatsApp sem quebrar o que já funciona.

## FASE 1 — Visibilidade robusta de conversas

**Backend (DB):**
- Criar função `can_user_see_conversation(_user_id uuid, _conv_id uuid) RETURNS boolean` (SECURITY DEFINER) com lógica:
  - Admin/super_admin do tenant → true
  - `assigned_to = user_id` → true
  - Cliente da conversa pertence à carteira do operador (`clients.operator_id = profile_id`) → true
  - Existe registro em nova tabela `conversation_transfers` com `to_user_id = user_id` ativo → true
  - Status da conversa está em lista permitida via `tenant_settings.whatsapp_visibility_open_statuses` (ex: "acordo_vigente", "quitado") → true
- Criar nova RPC `get_visible_conversations(_tenant_id, filtros, paginação)` que aplica essa regra server-side, substituindo a query atual de `fetchConversations` para operadores não-admin.
- Atualizar RLS de `conversations` e `chat_messages` usando essa função.

**Frontend:**
- `conversationService.fetchConversations` chama a nova RPC quando o usuário não for admin.
- Sem mudança visual — apenas a lista filtra corretamente.

## FASE 2 — Aceite manual reforçado

**Backend:**
- Edge function `send-chat-message`: validar antes de enviar que `conversation.status != 'waiting'`. Retornar 403 com erro claro se estiver.
- Aplicar mesma regra para envio de mídia (mesma função).

**Frontend:**
- `ChatPanel.tsx`: já tem `disabled` no input — estender para botões de mídia, áudio, quick replies (já existe parcial; auditar e fechar brechas).

## FASE 3 — Transferência de conversa

**DB:**
- Nova tabela `conversation_transfers` (id, conversation_id, tenant_id, from_user_id, to_user_id, reason, created_at).
- RLS: tenant-isolada via `get_my_tenant_id()`.

**Backend:**
- Nova edge function `transfer-conversation`: valida tenant, valida que `to_user_id` pertence ao tenant, atualiza `conversations.assigned_to`, insere em `conversation_transfers`, cria notificação para destinatário, registra `client_event` tipo `conversation_transferred`.

**Frontend:**
- Botão "Transferir" no header do `ChatPanel`.
- Dialog com `<Select>` de operadores do tenant + campo opcional de motivo.
- Mostrar histórico de transferências em sub-aba do painel direito.

## FASE 4 — Fechamento manual com tabulação obrigatória

**Frontend:**
- Interceptar transição `open/waiting → closed` em `ChatPanel.tsx`:
  - Abrir modal com `DispositionSelector` (já existente) + validação: ao menos 1 disposição selecionada.
  - Só permitir `updateConversationStatus(id, 'closed')` após persistir a disposição.
- Reaproveitar 100% a estrutura existente de `call_disposition_types` / `conversation_disposition_assignments`.

**Backend:**
- Trigger ou edge function que, ao fechar conversa, valida existência de disposição (defesa em profundidade).
- Integração com `client_events` já existe via triggers — apenas garantir que a disposição entre no metadata.

## FASE 5 — Auto-close interno configurável

**DB:**
- Adicionar coluna `whatsapp_autoclose_settings JSONB` em `tenants` (ou usar `tenant_settings` se já existir):
  ```json
  { "enabled": true, "inactivity_hours": 24, "applies_to_statuses": ["open"], "applies_to_official": true, "applies_to_unofficial": true }
  ```
- Adicionar coluna `last_interaction_at` em `conversations` (atualizada via trigger em `chat_messages` insert — apenas mensagens não-internas).

**Backend:**
- Nova edge function `whatsapp-autoclose-runner`:
  - Lê settings de cada tenant
  - Busca conversas elegíveis (`status IN settings.statuses`, `last_interaction_at < now() - inactivity_hours`)
  - Fecha + cria disposição automática "auto_close" + registra `client_event`
- Cron via `pg_cron` rodando a cada 30min.

**Frontend:**
- Nova aba "Personalização" em `ContactCenterPage.tsx` (whatsapp), ao lado de "Respostas Rápidas".
- Form para editar settings de auto-close (toggle, horas, status, oficial/não-oficial).

## FASE 6 — Alerta multi-instância

**Backend:**
- Nova função RPC `get_other_active_conversations(_client_id, _exclude_conv_id, _window_hours)` retornando lista com instância, operador, status, última interação.

**Frontend:**
- Componente `MultiInstanceAlert` em `ChatPanel.tsx`, exibido como banner discreto no topo da área de mensagens (não na sidebar).
- Texto: "Este cliente já possui contato recente em outro número (Instância X, operador Y, última interação Zh atrás)".
- Sem bloqueio, sem popup, sem indicador na lista.

## FASE 7 — Ajustes UX

- Manter relógio SLA oficial atual intacto.
- Adicionar indicador separado dentro do `ChatPanel` (não na lista) para auto-close interno: "Fechamento automático em Xh Ym" — apenas quando settings estiver ativo.
- Usar ícones e cores distintas dos do SLA oficial (ex: ícone `Timer` cinza vs `Clock` colorido).

---

## Ordem de entrega

Cada fase será uma entrega independente, testável, sem quebra. Confirmação ao final de cada fase antes de iniciar a próxima.

## Arquivos principais a alterar/criar

- `supabase/migrations/*` — funções SQL, tabelas novas, colunas novas
- `supabase/functions/transfer-conversation/index.ts` (novo)
- `supabase/functions/whatsapp-autoclose-runner/index.ts` (novo)
- `supabase/functions/send-chat-message/index.ts` (validação waiting)
- `src/services/conversationService.ts` (nova RPC, transferência)
- `src/components/contact-center/whatsapp/ChatPanel.tsx` (banner multi-instância, modal de fechamento, botão transferir, indicador auto-close)
- `src/components/contact-center/whatsapp/WhatsAppSettingsTab.tsx` (novo — auto-close config)
- `src/pages/ContactCenterPage.tsx` (nova aba)

## Confirmação solicitada

Posso seguir começando pela **Fase 1** após sua aprovação?

