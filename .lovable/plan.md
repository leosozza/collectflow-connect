# Plano: Integração Socket.IO em tempo real com 3CPLUS

Objetivo: tornar a tela de Telefonia/Contact Center reativa em tempo real via Socket.IO da 3CPLUS, mantendo o `threecplus-proxy` (REST) como fallback de polling e como canal único para ações (login, logout, pausa, qualificação, campanhas, gravações, spy, mailing, relatórios).

## Arquitetura

```text
┌──────────────────────────┐       Socket.IO (tempo real)
│  useThreeCPlusSocket     │◄──────────────────────────┐
│  (hook central)          │                           │
│  - connected/reconnect   │                           │
│  - eventos brutos        │            ┌──────────────┴────────┐
└─────────────┬────────────┘            │ socket.3c.plus        │
              │                         │ (3CPLUS realtime)     │
              ▼                         └──────────────┬────────┘
┌──────────────────────────┐                           │
│ AtendimentoModalProvider │                           │
│  + liveAgentState        │   REST fallback / ações  ▼
│  + ACW / lastCallId      │   ┌──────────────────────────┐
│  + dispatcher disca      │   │ threecplus-proxy (REST)  │
└─────────────┬────────────┘   │ login/logout/qual/etc.   │
              │                 └──────────────────────────┘
              ▼
┌──────────────────────────┐
│ TelefoniaDashboard       │  Polling de segurança 60–120s
│ AgentStatusTable         │  Botão "Reconectar socket"
│ TelefoniaAtendimentoWrap │  Indicador "Tempo real"
└──────────────────────────┘
              │
              ▼  call-was-connected → /atendimento/:id?...
```

Fontes de verdade após a mudança:
- Status do agente, chamadas ativas, ACW, agendamentos, lista vazia: **Socket.IO**.
- Polling REST (`agents_status`, `company_calls`) só roda quando o socket está desconectado, ou em sincronização leve a cada 60–120s, ou via botão manual.

## Confirmação dos nomes de eventos

Antes de finalizar, abrir a coleção Postman da 3CPLUS e confirmar 1:1 os nomes de eventos do `socket.3c.plus`. Se algum evento listado abaixo aparecer com nome diferente (ex.: pt-BR ou camelCase), padronizamos um mapa `EVENT_NAMES` no hook para isolar o resto do código de mudanças do provedor.

Eventos cobertos (alvos):
- Agente: `agent-is-idle`, `agent-in-acw`, `agent-login-failed`, `agent-logged-out`, `agent-entered-manual-call`, `agent-manual-call-enter-failed`, `agent-left-manual-call`, `agent-manual-call-exit-failed`, `agent-entered-work-break`, `agent-work-break-enter-failed`, `agent-left-work-break`, `agent-work-break-exit-failed`, `schedule-notification`.
- Chamadas discador: `call-was-created`, `call-was-answered`, `call-was-connected`, `call-was-hung-up`, `call-was-finished`, `call-was-abandoned`, `call-was-abandoned-by-amd`, `call-was-not-answered`, `call-failed`, `call-history-was-created`.
- Manuais: `manual-call-was-created`, `manual-call-was-connected`, `manual-call-was-answered`, `manual-call-was-hung-up`, `manual-call-was-finished`, `manual-call-was-not-answered`, `manual-call-failed`, `manual-call-history-was-created`.
- Receptivo: `receptive-entered-queue`, `receptive-connected-to-agent`, `receptive-abandoned`, `receptive-finished`.
- Spy: `spy-snoop-started`, `spy-snoop-finished`, `spy-snoop-failed`.
- Lista: `mailing-list-empty`.

## Etapas de implementação

### 1. Dependência
- Adicionar `socket.io-client`.

### 2. Hook central — `src/hooks/useThreeCPlusSocket.ts`
- Conecta em `https://socket.3c.plus/` com `auth: { token: tenant.settings.threecplus_api_token }` e query `{ company: cleanDomain }` (ajustar conforme Postman; sem expor token em logs).
- Singleton por `tenant.id` em módulo: evita múltiplas conexões quando vários componentes montarem.
- Reconexão automática (`reconnection: true`, backoff exponencial), com estados expostos: `connected`, `reconnecting`, `disconnected`, `error`, `lastEventAt`, `lastEvent`.
- API: `subscribe(eventName, handler)`, `subscribeMany(map)`, `disconnect()`, `forceReconnect()`.
- Cleanup completo de listeners no `useEffect` retorno.
- Sem credenciais → estado `idle`, não tenta conectar.

### 3. Provider de eventos — `AtendimentoModalProvider`
- Instanciar `useThreeCPlusSocket` aqui (uma vez por sessão autenticada).
- Mapear eventos para `liveAgentState` (substitui o que hoje vem de `useThreeCPlusStatus`):
  - `agent-is-idle` / `agent-in-acw` / `agent-entered-work-break` / `agent-left-work-break` / `agent-logged-out` → atualiza `status`/`isOnline`.
  - `call-was-connected` / `manual-call-was-connected` / `receptive-connected-to-agent` → preenche `callId`, `activeCallPhone`, `activeCallCpf`, `activeCallClientDbId` (a partir de `Extra3`/`mailing.extra3`).
  - `call-was-hung-up` / `call-was-finished` / `manual-call-was-hung-up` / `manual-call-was-finished` → marca `lastCallId`, mantém ACW até qualificação.
  - `mailing-list-empty` → toast informativo na tela.
  - `schedule-notification` → toast/notificação + invalidate da query de agendamentos.
- `useThreeCPlusStatus` (polling) é mantido como **fallback**: só faz polling se o socket reportar `connected === false` por mais de N segundos, e em intervalos longos (60s padrão, 120s para admin). O botão manual continua funcional.

### 4. Abertura automática da ficha (`call-was-connected`)
- Em `AtendimentoModalProvider`, ao receber `call-was-connected` cujo `agent_id` bate com `profile.threecplus_agent_id`:
  1. Extrair `phone`, `identifier` (CPF), `Extra3` (clientDbId) e `telephony_id`/`call.id`.
  2. Guardar em `Set<string>` os `callId` já roteados nesta sessão para impedir abrir a mesma chamada duas vezes.
  3. Resolver cliente: prioridade `clientDbId` → CPF (`clients.cpf`) → telefone (`resolve_client_by_phone`).
  4. Navegar para `/atendimento/:clientId?agentId=...&callId=...&channel=call` ou `/atendimento?phone=...&channel=call` quando não houver match.
- Hoje essa lógica vive em `TelefoniaAtendimentoWrapper`: ela continua funcionando para o caminho REST, mas o gatilho passa a ser o evento Socket.IO via provider (não depende mais do dashboard montado).

### 5. ACW / TPA / Qualificação
- `agent-in-acw`, `call-was-hung-up`, `call-was-finished` em tempo real → `setIsACW(true)`, `setLastCallId`, `setLastCallPhone` no `TelefoniaDashboard`.
- A regra atual de exigir disposição/qualificação antes de encerrar atendimento permanece — só mudamos a fonte do gatilho (socket em vez de transição detectada via polling).

### 6. Persistência — tabela `threecplus_socket_events`
- Migração para criar a tabela (campos sugeridos do briefing): `id uuid pk`, `tenant_id uuid not null`, `event_name text`, `external_company_id text`, `external_agent_id text`, `external_call_id text`, `external_campaign_id text`, `phone text`, `payload jsonb`, `received_at timestamptz default now()`, `processed_at timestamptz`, `processing_status text default 'pending'`, `error_message text`.
- RLS: `select`/`insert` permitidos para usuários do tenant via `get_my_tenant_id()`; sem `update`/`delete` de operador.
- Índices: `(tenant_id, received_at desc)`, `(tenant_id, external_call_id)`, `(tenant_id, event_name)`.
- Edge Function nova `threecplus-socket-ingest` (`verify_jwt = false`, validação por header `x-rivo-secret`): recebe lote de eventos do frontend e grava em batch. **Dedup** por `(event_name, external_call_id, payload->>'status')` usando `on conflict do nothing` em índice único parcial — evita poluição quando reconexões reentregam.
- Frontend: o hook empilha eventos brutos e despacha em batch (debounce 1s) para a edge function, sem bloquear o pipeline reativo.

### 7. Reflexo no CRM
- Em `call-history-was-created` / `manual-call-history-was-created`: invocar serviço (já existente em parte via `callService`) para upsert em `call_logs` vinculando:
  - `client_id` (resolvido por CPF/telefone/Extra3),
  - `operator_id` via `profiles.threecplus_agent_id`,
  - duração, gravação_url, disposição quando vier no payload.
- Adicionar entrada em `client_events` (timeline) com `type='call'` e `session_id` quando houver atendimento ativo (segue padrão `mem://logic/history/unified-session-timeline`).
- Métricas (CPC, acordos, score) já consomem `call_dispositions`/`agreements` — sem mudança aqui.

### 8. Segurança
- Token só em memória do hook; nunca logado. Logs usam `***`.
- Validar e normalizar domínio: aceitar `empresa.3c.plus`, remover `https://`, recusar `3c.fluxoti.com` para socket/REST novos. Atualizar `threecplus-proxy` para também forçar `*.3c.plus` (manter compat se a 3CPLUS ainda aceitar fluxoti — apenas warning).
- Se a checagem prática mostrar que o socket exige token em formato que expõe segredo sensível no browser, plano B: criar Edge Function `threecplus-socket-broker` (Deno + `socket.io-client`) que mantém a conexão server-side e republica eventos via Supabase Realtime (`postgres_changes` em `threecplus_socket_events`). Decisão final é tomada após validação prática do endpoint.
- Não remover ou enfraquecer `threecplus-proxy`.

### 9. UI no painel de telefonia
- Componente novo `RealtimeStatusBadge` no header do `TelefoniaDashboard`:
  - verde "Tempo real conectado",
  - amarelo "Reconectando…",
  - cinza "Tempo real desconectado — usando atualização automática",
  - hora da última mensagem,
  - botão "Reconectar socket" → `forceReconnect()`.
- Ajustar o seletor de intervalo: quando socket conectado, exibe "Tempo real" desabilitado (intervalo passa a ser fallback 60–120s); quando desconectado, retoma 3s/15s atuais.

### 10. Testes
- Testes manuais cobertos no checklist do briefing (entrar campanha → idle → call-was-created → answered → connected → ficha abre → hung-up → ACW → qualificação → idle; mailing vazio; queda do socket cai para polling; reconexão sem duplicar abertura de ficha).
- Adicionar teste unitário leve do hook (`useThreeCPlusSocket`) com mock de `socket.io-client` cobrindo: cleanup, dedup de subscribe e troca de tenant.

## Arquivos a criar/editar

Novo:
- `src/hooks/useThreeCPlusSocket.ts`
- `src/components/contact-center/threecplus/RealtimeStatusBadge.tsx`
- `supabase/functions/threecplus-socket-ingest/index.ts`
- Migração SQL: `threecplus_socket_events` + RLS + índices.

Editado:
- `src/hooks/useAtendimentoModal.tsx` — instanciar socket, alimentar `liveAgentState` por eventos, gatilho de abertura de ficha por `call-was-connected`.
- `src/hooks/useThreeCPlusStatus.ts` — vira fallback (intervalos 60–120s, pula polling se socket conectado).
- `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` — consumir socket para status/ACW/lastCall, badge de realtime, ajustar intervalos.
- `src/components/contact-center/threecplus/AgentStatusTable.tsx`, `AgentDetailSheet.tsx`, `CallHistoryPanel.tsx`, `OperatorCallHistory.tsx` — refletir eventos em tempo real (revalidate de queries quando `call-history-was-created` chegar).
- `package.json` — `socket.io-client`.
- `supabase/config.toml` — bloco da nova edge function se precisar de `verify_jwt = false`.

Não tocar:
- `supabase/functions/threecplus-proxy/index.ts` (ações REST), exceto endurecimento opcional de domínio.

## Riscos e mitigação
- **Autenticação real do socket pode diferir do esperado** — confirmar via Postman antes de codar; se exigir handshake server-side seguro, ativar plano B (broker em Edge Function + Supabase Realtime).
- **Eventos duplicados em reconexão** — dedup por `callId` para abertura de ficha + dedup no insert da tabela.
- **Múltiplas abas abertas pelo mesmo operador** — singleton por tenant cuida da conexão; abertura de ficha é por `Set` em sessionStorage para evitar duas abas abrindo a mesma chamada (fallback: usar `BroadcastChannel`).
- **Custo/poluição da tabela de eventos** — manter retenção via cron/SQL (ex.: `delete from threecplus_socket_events where received_at < now() - interval '14 days'`), agendar depois.
