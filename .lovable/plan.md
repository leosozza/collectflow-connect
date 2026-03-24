

# Plano: Botão "Encerrar Chamada" funcional na /atendimento

## Análise do estado atual

A infraestrutura já existe quase completa:

1. **`ClientHeader.tsx`** já renderiza um botão "DESLIGAR" (vermelho, `PhoneOff`) quando `hasActiveCall && onHangup` — linhas 249-260
2. **`AtendimentoPage.tsx`** já tem `handleHangup` (linhas 310-335) que chama `hangup_call` via proxy
3. **`AtendimentoPage.tsx`** passa `hasActiveCall={!!callId}` ao ClientHeader — linha 426
4. O `callId` vem das props do `AtendimentoPage`, que vem do modal context (`state.callId`)
5. O `TelefoniaAtendimentoWrapper` passa `callId={activeCall?.call_id || myAgent?.call_id || myAgent?.current_call_id}` via `updateAtendimento`

**Problema principal**: O `callId` chega corretamente ao `AtendimentoPage` e o botão aparece, mas há gaps:
- O `callId` pode ser `undefined` se a chamada foi detectada sem call_id no polling
- Após hangup, o status visual não transita explicitamente para "TPA" na AtendimentoPage
- Não há registro de evento `call_hangup` no `client_events`
- O estado da chamada ativa não é limpo após qualificação

## Correções necessárias

### 1. `AtendimentoPage.tsx` — Melhorar handleHangup

**Problema**: Se `callId` é undefined, mostra erro genérico. Também não registra evento de hangup no histórico.

- Adicionar fallback para `callId`: verificar `sessionStorage.getItem("3cp_last_call_id")` quando `callId` da prop é undefined
- Após hangup com sucesso, registrar evento `call_hangup` em `client_events` com metadata (call_id, operator, timestamp)
- Manter tela aberta e tabulações disponíveis (já funciona — não navega após hangup)

### 2. `AtendimentoPage.tsx` — Estado visual pós-hangup

- Adicionar state `callHungUp` (boolean, default false)
- Após hangup sucesso, setar `callHungUp = true`
- O banner de status (linhas 371-392) já mostra "TPA — Pós-atendimento" quando `agentStatus` muda para 3/4 após hangup — o TelefoniaDashboard atualiza via polling
- Passar `hasActiveCall={!!callId && !callHungUp}` para ClientHeader — esconde botão DESLIGAR após já ter desligado

### 3. `AtendimentoPage.tsx` — Limpar estado após qualificação

No `onSuccess` do `dispositionMutation` (linha 157), adicionar:
- `setCallHungUp(false)` — reset para próximo atendimento
- Já limpa `sessionStorage` items de 3CPlus (linhas 181-182)

### 4. `AtendimentoPage.tsx` — callId com fallback robusto

Criar `effectiveCallId` que combina:
```typescript
const effectiveCallId = callId || sessionStorage.getItem("3cp_last_call_id");
```
Usar em `handleHangup` e em `hasActiveCall`

### 5. `AtendimentoPage.tsx` — Mostrar hasActiveCall corretamente

Atualmente: `hasActiveCall={!!callId}` — depende da prop
Corrigir para: `hasActiveCall={!!effectiveCallId && !callHungUp && Number(agentStatus) === 2}`

O botão DESLIGAR aparece **somente** quando:
- Existe um callId (da prop ou sessionStorage)
- A chamada ainda não foi desligada nesta sessão
- O agente está em status 2 (em ligação)

### 6. Registro de eventos no histórico

**Hangup**: inserir `client_events` com `event_type: 'call_hangup'`
**Conexão da chamada**: já é registrada pelo trigger `trg_client_event_from_call_log` quando o call_log é salvo
**Qualificação**: já é registrada pelo trigger `trg_client_event_from_disposition`

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/pages/AtendimentoPage.tsx` | Adicionar state `callHungUp`; fallback `effectiveCallId`; registrar evento `call_hangup`; condicionar `hasActiveCall` a status 2 |

## O que NÃO muda

- `ClientHeader.tsx` — o botão DESLIGAR já existe e já está estilizado corretamente
- `TelefoniaDashboard.tsx` — a detecção de chamada e passagem de callId já funciona
- `useAtendimentoModal.tsx` — o contexto já transporta callId
- `threecplus-proxy` — a ação `hangup_call` já funciona
- Layout da tela, fluxo de tabulação, histórico existente

