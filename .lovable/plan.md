
# WhatsApp CRM Conversacional Completo

Sistema de atendimento WhatsApp estilo CRM (como Kommo/Octadesk) integrado ao /contact-center/whatsapp, com 4 fases de implementacao.

---

## Visao Geral da Arquitetura

O sistema sera construido em 4 fases progressivas, cada uma entregando valor funcional independente:

```text
+-----------------------------------------------------------------------------------+
|  /contact-center/whatsapp                                                         |
|                                                                                   |
|  +-------------+  +-------------------------------+  +-------------------------+  |
|  | Lista de    |  | Painel de Chat                |  | Sidebar CRM            |  |
|  | Conversas   |  |                               |  |                        |  |
|  |             |  | [Header contato]              |  | Dados do cliente       |  |
|  | Busca       |  | [Mensagens scrollable]        |  | Etiquetas              |  |
|  | Filtros     |  | [Sugestao IA]                 |  | Historico parcelas     |  |
|  | Status      |  | [Input: texto/audio/emoji]    |  | Timeline               |  |
|  | Etiquetas   |  |                               |  | Notas internas         |  |
|  |             |  |                               |  | Vincular cliente       |  |
|  +-------------+  +-------------------------------+  +-------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## Fase 1 - Chat Funcional (MVP)

### Banco de Dados

Novas tabelas:

**conversations** - Gerencia conversas agrupadas por contato
- id, tenant_id, instance_id, remote_phone, remote_name, status (open/waiting/closed), assigned_to (profile_id), last_message_at, unread_count, created_at, updated_at

**chat_messages** - Mensagens individuais (substitui message_logs para chat)
- id, conversation_id, tenant_id, direction (inbound/outbound), message_type (text/image/audio/video/document/sticker), content, media_url, media_mime_type, status (pending/sent/delivered/read/failed), external_id, created_at

Habilitar Realtime em ambas as tabelas para atualizacao em tempo real.

RLS: operadores veem apenas conversas das instancias vinculadas via operator_instances; admins veem todas do tenant.

### Edge Function: whatsapp-webhook

Recebe webhooks da Evolution API (mensagens recebidas, status updates). Cria/atualiza conversations e chat_messages automaticamente.

### Edge Function: send-whatsapp (atualizar evolution-proxy)

Nova action "sendMessage" no evolution-proxy para enviar texto, midia via instancia especifica.

### Frontend - Layout 3 paineis

**ConversationList** (coluna esquerda ~300px)
- Busca por nome/telefone
- Filtro por status (aberta, aguardando, fechada)
- Filtro por instancia
- Lista com avatar, nome, ultima mensagem, hora, badge unread
- Indicador de instancia

**ChatPanel** (coluna central, flex-1)
- Header: nome contato, telefone, status, instancia
- Area de mensagens com scroll automatico, bolhas estilo WhatsApp
- Tipos de mensagem: texto, imagem (preview), audio (player), documento (link download)
- Input com campo texto + botao enviar
- Status de entrega (enviado/entregue/lido) com icones

**ContactSidebar** (coluna direita ~320px, colapsavel)
- Dados basicos do contato (nome, telefone)
- Botao "Vincular Cliente" para associar a um cliente cadastrado
- Se vinculado: mostrar dados do cliente (CPF, parcelas, status)

### Acesso

- Remover restricao `profile?.role !== "admin"` da ContactCenterPage para channel whatsapp
- Operadores veem apenas conversas das instancias vinculadas (via operator_instances)
- Admins veem todas as conversas do tenant

---

## Fase 2 - Midia, Etiquetas e Busca

### Audio

- Gravador de audio no browser usando MediaRecorder API
- Upload para storage bucket "chat-media"
- Envio via Evolution API (formato OGG/OPUS)
- Player inline nas mensagens recebidas/enviadas

### Emoji Picker

- Componente emoji picker (usando biblioteca leve como emoji-mart ou picker nativo)
- Integrado ao input do chat

### Upload de Midia

- Botao de anexar (imagem, documento, video)
- Upload para storage, envio via Evolution API
- Preview inline (imagem) ou link (documento)

### Sistema de Etiquetas

Nova tabela **conversation_tags**:
- id, tenant_id, name, color, created_at

Nova tabela **conversation_tag_assignments**:
- conversation_id, tag_id

- UI para criar/gerenciar etiquetas
- Atribuir etiquetas na sidebar do contato
- Filtrar conversas por etiqueta na lista

### Busca Global

- Busca full-text em chat_messages.content
- Busca por nome, telefone, etiqueta
- Resultados com destaque e navegacao para a conversa

---

## Fase 3 - IA Inteligente

### Sugestao de Resposta

- Edge function "chat-ai-suggest" usando Lovable AI (gemini-3-flash-preview)
- Contexto enviado: ultimas N mensagens + dados do cliente (se vinculado) + base de conhecimento
- Botao "Sugestao IA" no chat que gera resposta sugerida
- Operador pode editar antes de enviar ou descartar

### Resumo da Conversa

- Botao na sidebar para gerar resumo automatico da conversa
- Util para handoff entre operadores

### Classificacao Automatica

- Ao receber mensagem, IA classifica intencao (cobranca, suporte, cancelamento, etc.)
- Sugestao automatica de etiqueta baseada na classificacao

---

## Fase 4 - Automacao e Avancado

### Distribuicao Automatica

- Conversas novas atribuidas automaticamente ao operador com menos conversas abertas (round-robin)
- Respeitar vinculo operador-instancia

### Respostas Rapidas

Nova tabela **quick_replies**: id, tenant_id, shortcut, content, category
- Digitar "/" no chat abre lista de respostas rapidas
- Admin configura templates

### SLA e Alertas

- Tempo maximo sem resposta configuravel
- Notificacao quando conversa ultrapassa SLA
- Indicador visual na lista de conversas

### Notas Internas

- Mensagens internas (nao enviadas ao cliente) dentro da conversa
- Visivel apenas para operadores
- Util para anotacoes e handoff

---

## Detalhes Tecnicos

### Estrutura de Arquivos (novos)

```text
src/
  components/
    contact-center/
      whatsapp/
        ConversationList.tsx
        ChatPanel.tsx
        ChatMessage.tsx
        ContactSidebar.tsx
        ChatInput.tsx
        ConversationFilters.tsx
        EmojiPicker.tsx        (Fase 2)
        AudioRecorder.tsx      (Fase 2)
        TagManager.tsx         (Fase 2)
        AISuggestion.tsx       (Fase 3)
  services/
    conversationService.ts
    chatMessageService.ts
  hooks/
    useConversations.ts
    useChatMessages.ts

supabase/functions/
  whatsapp-webhook/index.ts    (atualizar)
  evolution-proxy/index.ts     (adicionar sendMessage)
  chat-ai-suggest/index.ts     (Fase 3)
```

### Realtime

- `conversations` e `chat_messages` com Realtime habilitado
- Subscricao por tenant_id para atualizacao instantanea da lista e do chat

### Storage

- Bucket "chat-media" para arquivos de audio, imagem, documento
- RLS: acesso por tenant_id

### Webhook Evolution API

- A Evolution API envia webhooks para mensagens recebidas e status updates
- O endpoint whatsapp-webhook processa e armazena em conversations/chat_messages
- Precisa configurar o webhook URL na instancia Evolution (via evolution-proxy action "setWebhook")

---

## Ordem de Implementacao

Cada fase sera quebrada em prompts menores para implementacao incremental:

**Fase 1** (prioridade):
1. Migracoes DB (conversations, chat_messages)
2. Edge function webhook + sendMessage
3. ConversationList component
4. ChatPanel + ChatMessage components
5. ChatInput (texto)
6. ContactSidebar + vincular cliente
7. Integracao Realtime
8. Abrir acesso para operadores

**Fase 2**: Audio, Emoji, Upload, Etiquetas, Busca
**Fase 3**: IA (sugestao, resumo, classificacao)
**Fase 4**: Automacao, respostas rapidas, SLA, notas internas
