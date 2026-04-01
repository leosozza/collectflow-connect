

# Plano: Rodada Final de Hardening Pós-Implantação

## Resumo

Fechar pendências críticas: lock real com somente-leitura + takeover funcional, migrar MaxList para edge function, reforçar tenant_id nas queries do Atendimento/Telefonia/WhatsApp, migrar observações para leitura estruturada, paginação real no WhatsApp, e polling adaptativo na telefonia. Sem alterar layout, sem criar telas.

---

## Bloco 1: Lock Real no Atendimento

**Estado atual**: `isLocked` existe, banner aparece, mas DispositionPanel, DebtorCategoryPanel, AgreementCalculator e observações continuam habilitados.

### 1.1 — Desabilitar ações quando `isLocked === true`

Em `AtendimentoPage.tsx`:
- Passar `disabled={isLocked}` para `DispositionPanel` (prop nova, desabilita botões internos)
- Passar `disabled={isLocked}` para `DebtorCategoryPanel`
- Ocultar botão "Formalizar Acordo" quando `isLocked`
- Passar `onSaveNote={isLocked ? undefined : handleSaveNote}` para `ClientObservations` (já esconde o form quando `onSaveNote` é undefined)
- Desabilitar `handleCall` e `handleHangup` quando `isLocked`

### 1.2 — Takeover funcional

- Adicionar botão "Assumir Atendimento" no banner de lock, visível apenas para roles `admin`, `gerente`, `supervisor`
- Usar `takeoverLock` do `lockService.ts` (já existe)
- Após takeover: `setIsLocked(false)`, `setLockOwner(null)`, iniciar renovação
- Registrar `logAction({ action: "atendimento_takeover", ... })`

### 1.3 — Verificar role do operador

- Usar `useTenant()` → `tenantUser.role` para checar se é admin/gerente/supervisor
- Condicionar visibilidade do botão de takeover

### Componentes a alterar para aceitar `disabled`:
- `DispositionPanel.tsx` — adicionar prop `disabled`, desabilitar submit
- `DebtorCategoryPanel.tsx` — adicionar prop `disabled`, desabilitar select/save

---

## Bloco 2: Migrar MaxList para Edge Function

**Estado atual**: Frontend busca 5000 registros por vez do MaxSystem, acumula em `allItems`, processa mapping e faz upsert em batches de 1000 — tudo no browser.

### 2.1 — Criar edge function `maxlist-import`

Recebe:
```json
{
  "tenant_id": "uuid",
  "filter": "string (OData filter)",
  "credor": "string",
  "field_mapping": { ... },
  "status_cobranca_id": "uuid | '__auto__' | null"
}
```

Lógica interna:
1. Buscar dados do MaxSystem em pages de 5000 (mesma lógica que `maxsystem-proxy`)
2. Mapear cada registro usando `field_mapping` (mesma lógica de `buildRecordFromMapping`)
3. Normalizar CPF (padStart 11) e telefone
4. Deduplicar por `external_id`
5. Upsert em batches de 500 com `onConflict: "external_id,tenant_id"`
6. Se `status_cobranca_id === "__auto__"`, chamar `auto-status-sync` ao final
7. Retornar relatório: `{ inserted, updated, rejected, skipped }`

Timeout: 300s (import pode ser longo — configurar no `config.toml`)

### 2.2 — Simplificar `MaxListPage.tsx`

- `handleMappingConfirmed` → chama `supabase.functions.invoke("maxlist-import", { body: {...} })`
- Exibe loading + resultado retornado
- Remove: acúmulo de `allItems` no state para import (manter para preview)
- Preview: limitar a 50 registros no frontend para visualização

### 2.3 — Config TOML

Adicionar bloco de função para timeout:
```toml
[functions.maxlist-import]
verify_jwt = false
```

---

## Bloco 3: Tenant_id Explícito nas Queries Operacionais

### 3.1 — `AtendimentoPage.tsx`

Queries sem `.eq("tenant_id")`:
- L136: `clientRecords` query — busca por CPF sem tenant → adicionar `.eq("tenant_id", tenant.id)`
- L163: `agreements` query — busca por CPF sem tenant → adicionar `.eq("tenant_id", tenant.id)`
- L182: `callLogs` query — busca por CPF sem tenant → adicionar `.eq("tenant_id", tenant.id)`
- L123: `client` query — por ID, ok (unique), mas adicionar tenant para defesa

### 3.2 — `TelefoniaDashboard.tsx`

- L56: `clientByCpf` query — `.eq("cpf", cleanCpf)` sem tenant → adicionar tenant_id
- Requer propagar `tenantId` para `TelefoniaAtendimentoWrapper`

### 3.3 — `auto-status-sync`

- L173: `.in("id", batch)` sem `.eq("tenant_id")` → adicionar
- L236: `.in("id", batch)` sem `.eq("tenant_id")` → adicionar

### 3.4 — `WhatsAppChatLayout.tsx`

- L125: `clients` query por `selectedConv.client_id` — sem tenant → adicionar `.eq("tenant_id", tenantId)`

### 3.5 — `conversationService.ts`

- `deleteConversation`: delete `chat_messages` sem tenant filter → ok (FK), mas defensivo: adicionar
- `sendTextMessage` L131: conversation select sem tenant → adicionar

---

## Bloco 4: Observações Estruturadas

**Estado atual**: `ClientObservations` lê de `clients.observacoes` (string concatenada). A timeline já lê de `client_events`. Há gravação dual.

### 4.1 — Migrar `ClientObservations` para ler de `client_events`

- Em vez de receber `observacoes` string e parsear, buscar `client_events` com `event_type = "observation_added"` filtrado por `client_id`
- Exibir `metadata.note`, `metadata.operator_name`, `created_at`
- Props: `clientId` + `tenantId` em vez de `observacoes`

### 4.2 — Truncar gravação em `clients.observacoes`

Em `handleSaveNote`: limitar `clients.observacoes` às últimas 3 entradas (resumo), não o log completo.

### 4.3 — Manter gravação dual

Continuar salvando em `client_events` + `clients.observacoes` (truncado).

---

## Bloco 5: Paginação Real no WhatsApp

**Estado atual**: `fetchConversations` e `fetchMessages` suportam paginação via `.range()`. Mas a UI não utiliza.

### 5.1 — Infinite scroll em `ConversationList`

- Adicionar `onLoadMore` callback prop
- Detectar scroll near-bottom do `ScrollArea`
- Concatenar novas conversas ao state existente
- Prop `hasMore: boolean` para controlar loading indicator

### 5.2 — `WhatsAppChatLayout` — usar paginação

- Substituir `loadConversations()` por paginação incremental
- Track `page` e `hasMoreConversations` no state
- `loadConversations` carrega page 1; `loadMore` incrementa page
- Mensagens: track `messagePage` + `hasMoreMessages`
- Ao selecionar conversa, carregar primeira página de mensagens
- Botão/scroll up para carregar histórico anterior

### 5.3 — Preservar conversa ativa

- Realtime já faz updates incrementais (implementado na Fase 2) — manter

---

## Bloco 6: Polling Adaptativo na Telefonia

**Estado atual**: Intervalo fixo de 3s (operador) ou 30s (admin). Sem backoff.

### 6.1 — Intervalo adaptativo em `TelefoniaDashboard.tsx`

Substituir `interval` fixo por cálculo dinâmico:
```typescript
const getAdaptiveInterval = () => {
  if (!myAgent || !isAgentOnline) return 30000;
  if (myAgent.status === 2) return 3000;  // em ligação
  if (myAgent.status === 3 || myAgent.status === 4) return 5000; // pausa/ACW
  if (myAgent.status === 1) return 10000; // ocioso
  return 15000;
};
```

### 6.2 — Backoff em erro

```typescript
const errorCountRef = useRef(0);
// Em fetchAll: errorCountRef.current++ em catch, reset em success
// Intervalo efetivo = baseInterval * (1 + Math.min(errorCountRef.current, 5))
```

### 6.3 — Aplicar intervalo dinâmico no useEffect

Substituir `setInterval(fetchAll, interval * 1000)` por `setTimeout` recursivo com intervalo recalculado a cada ciclo.

---

## Bloco 7: Auditoria Complementar

Garantir `logAction` em:
- Takeover de lock (Bloco 1)
- MaxList import (Bloco 2 — edge function loga internamente)
- Já existe em: observação, disposição, acordo, client update, import start/complete

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/AtendimentoPage.tsx` | Lock somente-leitura real + takeover + tenant_id nas queries |
| `src/components/atendimento/DispositionPanel.tsx` | Prop `disabled` |
| `src/components/atendimento/DebtorCategoryPanel.tsx` | Prop `disabled` |
| `src/components/atendimento/ClientTimeline.tsx` | `ClientObservations` lê de `client_events` |
| `supabase/functions/maxlist-import/index.ts` | Nova edge function |
| `src/pages/MaxListPage.tsx` | Delegar import ao backend |
| `supabase/functions/auto-status-sync/index.ts` | tenant_id nos `.in("id", batch)` |
| `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` | Paginação + tenant_id |
| `src/components/contact-center/whatsapp/ConversationList.tsx` | Infinite scroll |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Polling adaptativo + backoff + tenant_id |
| `src/services/conversationService.ts` | tenant_id defensivo |
| `supabase/config.toml` | Config para maxlist-import |

## O que NÃO muda
- Layout, design, componentes visuais — intactos
- Lógica de negócio (acordos, comissões, score) — intacta
- Estrutura de tabelas — intacta
- Fluxos operacionais aprovados — preservados

## Ordem de implementação
1. Lock real + takeover (AtendimentoPage + DispositionPanel + DebtorCategoryPanel)
2. Tenant_id explícito (queries do Atendimento, Telefonia, WhatsApp, auto-status-sync)
3. Observações estruturadas (ClientObservations migrado)
4. Edge function maxlist-import + simplificar MaxListPage
5. Paginação WhatsApp (ConversationList infinite scroll)
6. Polling adaptativo telefonia

