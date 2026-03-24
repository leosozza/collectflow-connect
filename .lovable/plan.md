

# Plano: Central Unica de Negociacao Omnichannel — /atendimento

## Visao Geral

Evoluir a /atendimento existente para funcionar como central unica de negociacao, servindo telefonia, WhatsApp, portal, IA WhatsApp e IA Voz, sem redesenhar a tela e sem criar uma segunda tela de atendimento.

## Fase 1 — Tabela `atendimento_sessions` (fundacao)

### Migracao SQL

Criar a tabela que representa o caso ativo de negociacao:

```sql
CREATE TABLE public.atendimento_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid REFERENCES clients(id),
  client_cpf text NOT NULL,
  credor text,
  status text NOT NULL DEFAULT 'open', -- open, closed
  origin_channel text NOT NULL, -- call, whatsapp, portal, ai_whatsapp, ai_voice
  current_channel text,
  origin_actor text, -- operator, ai, portal_self
  current_actor text,
  assigned_to uuid REFERENCES profiles(id),
  source_conversation_id uuid,
  source_call_id text,
  portal_session_id text,
  ai_session_id text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indice unico para regra: 1 sessao ativa por tenant+client+credor
CREATE UNIQUE INDEX idx_active_session ON atendimento_sessions (tenant_id, client_id, credor)
  WHERE status = 'open';

ALTER TABLE atendimento_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: usuarios autenticados do tenant
CREATE POLICY "Tenant users can manage sessions"
  ON atendimento_sessions FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());
```

Habilitar realtime para atualizacoes em tempo real:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimento_sessions;
```

### Servico `atendimentoSessionService.ts`

Criar servico com funcoes:

- `findOrCreateSession({ tenantId, clientId, clientCpf, credor, channel, actor, sourceConversationId?, sourceCallId?, assignedTo? })` — busca sessao ativa para tenant+client+credor; se nao existe, cria nova
- `updateSessionChannel(sessionId, channel, actor)` — atualiza `current_channel` e `current_actor`
- `closeSession(sessionId)` — marca `status=closed`, `closed_at=now()`
- `getActiveSession(tenantId, clientId, credor?)` — retorna sessao ativa se existir

## Fase 2 — Eventos estruturados para sessao

### Novos event_types no `client_events`

Adicionar coluna opcional `session_id` a `client_events`:

```sql
ALTER TABLE client_events ADD COLUMN session_id uuid REFERENCES atendimento_sessions(id);
```

Novos tipos de evento (nao requerem alteracao de schema, apenas uso no codigo):
- `atendimento_opened`
- `atendimento_closed`
- `channel_switched`
- `portal_negotiation_started`
- `portal_agreement_created`
- `ai_whatsapp_negotiation_started`
- `ai_voice_negotiation_started`

### Registro automatico de eventos

No `findOrCreateSession`, ao criar sessao nova, inserir evento `atendimento_opened` em `client_events`.
No `closeSession`, inserir evento `atendimento_closed`.
No `updateSessionChannel`, inserir evento `channel_switched`.

## Fase 3 — Adaptar a /atendimento

### `src/pages/AtendimentoPage.tsx`

Mudancas minimas:

1. Aceitar nova prop opcional `sessionId` e `channel` no `AtendimentoPageProps`
2. Se `sessionId` for passado, carregar dados da sessao e exibir badge do canal atual (WhatsApp/Telefonia/Portal/IA) no header
3. Se nao for passado (fluxo atual), continuar funcionando exatamente como hoje (compatibilidade total)
4. Ao tabular, se houver sessao ativa, associar o `session_id` ao evento de disposition

### `src/components/atendimento/DispositionPanel.tsx`

Renomear "Tabulacao da Chamada" para "Resultado do Atendimento" (uma mudanca de texto, linha 132).

### `src/components/atendimento/ClientTimeline.tsx`

Nenhuma mudanca estrutural. A timeline ja consome `client_events` e ja suporta os tipos whatsapp_inbound, whatsapp_outbound, agreement_*, call, disposition, field_update. Os novos event_types (`atendimento_opened`, `channel_switched`, etc.) serao adicionados aos mapas `EVENT_TYPE_LABELS`, `COLOR_MAP` e `TYPE_ICON` para renderizacao automatica.

## Fase 4 — Contexto omnichannel no modal

### `src/hooks/useAtendimentoModal.tsx`

Expandir interfaces para suportar contexto adicional:

```typescript
interface AtendimentoModalState {
  // ... campos existentes mantidos
  sessionId?: string;
  channel?: string; // 'call' | 'whatsapp' | 'portal' | 'ai_whatsapp' | 'ai_voice'
  conversationId?: string;
}
```

Expandir `openAtendimento` e `updateAtendimento` para aceitar esses campos opcionais.
O header do modal mostra icone do canal (Phone/MessageSquare/Globe/Bot) em vez de sempre Phone.

## Fase 5 — Botao "Abrir Atendimento" no WhatsApp

### `src/components/contact-center/whatsapp/ChatPanel.tsx`

Adicionar botao "Abrir Atendimento" no header do chat (ao lado do seletor de status):

- Visivel apenas quando a conversa tem `client_id` vinculado
- Ao clicar: chama `findOrCreateSession` com `channel='whatsapp'`, depois navega para `/atendimento?clientId={clientId}&sessionId={sessionId}&channel=whatsapp`
- Se ja existir sessao ativa, abre a existente
- Se a conversa nao tem client vinculado, mostra toast pedindo para vincular primeiro

### `src/components/contact-center/whatsapp/ContactSidebar.tsx`

Adicionar botao secundario "Ir para Atendimento" na secao do cliente vinculado (abaixo dos dados do cliente), como acao rapida alternativa.

## Fase 6 — Integracao com telefonia (preservar fluxo)

### `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

Ao abrir atendimento via chamada 3CPlus:
- Chamar `findOrCreateSession` com `channel='call'`, `sourceCallId=callId`
- Passar `sessionId` para o `openAtendimento`/`updateAtendimento`
- Nenhuma mudanca visual no fluxo do operador

## Fase 7 — Portal e IA (sem UI humana)

### Portal — `supabase/functions/portal-checkout/index.ts`

Ao criar acordo via portal:
- Chamar `findOrCreateSession` (via query direta no banco usando service_role) com `channel='portal'`, `actor='portal_self'`
- Inserir evento `portal_agreement_created` em `client_events` com `session_id`

### IA WhatsApp — `src/components/contact-center/whatsapp/AIAgentTab.tsx` (futuro)

Quando o agente IA processar negociacao:
- Criar/reutilizar sessao com `channel='ai_whatsapp'`
- Registrar eventos estruturados na sessao

(Esta fase e preparatoria — a infraestrutura fica pronta para quando IA de negociacao for implementada)

## Fase 8 — Observacoes estruturadas

### `src/pages/AtendimentoPage.tsx` — `handleSaveNote`

Alem de salvar em `clients.observacoes` (compatibilidade), tambem inserir em `client_events`:

```typescript
await supabase.from("client_events").insert({
  tenant_id: tenant.id,
  client_id: client.id,
  client_cpf: client.cpf,
  event_type: "observation_added",
  event_source: "operator",
  event_value: "note",
  metadata: { note: note, operator_name: profile.full_name, session_id: sessionId },
  session_id: sessionId || null,
});
```

Observacoes aparecem no historico mas NAO alimentam o score (o `calculate-propensity` ignora `observation_added`).

## Resumo de arquivos

| Arquivo | Mudanca |
|---|---|
| **Migracao SQL** | Criar tabela `atendimento_sessions` + indice unico + RLS + coluna `session_id` em `client_events` |
| `src/services/atendimentoSessionService.ts` | **Novo** — CRUD de sessoes |
| `src/pages/AtendimentoPage.tsx` | Aceitar `sessionId`/`channel` opcionais; salvar observacao como evento |
| `src/hooks/useAtendimentoModal.tsx` | Expandir state com `sessionId`/`channel`/`conversationId`; icone dinamico |
| `src/components/atendimento/DispositionPanel.tsx` | Renomear titulo para "Resultado do Atendimento" |
| `src/components/atendimento/ClientTimeline.tsx` | Adicionar labels/cores/icones para novos event_types |
| `src/components/contact-center/whatsapp/ChatPanel.tsx` | Botao "Abrir Atendimento" no header |
| `src/components/contact-center/whatsapp/ContactSidebar.tsx` | Botao "Ir para Atendimento" na secao do cliente |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Criar sessao ao abrir atendimento via chamada |
| `supabase/functions/portal-checkout/index.ts` | Criar sessao + evento ao gerar acordo pelo portal |

## O que NAO muda

- Layout da /atendimento (3 colunas: tabulacao/historico/observacoes)
- Fluxo da telefonia 3CPlus (mantido 100%)
- Timeline baseada em client_events (reaproveitada)
- Score operacional (alimentado apenas por eventos estruturados, nunca por texto livre)
- Compatibilidade com `clients.observacoes`

