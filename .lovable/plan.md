

# Plano: Corrigir tela do operador — Retomar, Tabulação e Intervalos

## Problemas identificados

### 1. Intervalos não aparecem para o operador
A resposta do `agents_status` da 3CPlus retorna apenas `{id, extension, name, status, status_start_time}` — **sem campo `campaign_id`**. O código depende de `myCampaignId` (linha 442: `myAgent?.campaign_id`) para disparar `loadPauseIntervals` (linha 636), mas esse valor é sempre `null`. Portanto os intervalos nunca são carregados.

**Correção**: Quando o operador faz login na campanha, salvar o `campaign_id` selecionado em `sessionStorage`. Usar esse valor como fallback quando `myAgent?.campaign_id` não estiver disponível. Isso garante que `loadPauseIntervals` seja chamado ao recarregar a página.

### 2. Botão "Retomar" não funciona após ligação
Quando uma chamada termina na 3CPlus, o agente entra automaticamente em "ACW" (After Call Work / pós-atendimento), que aparece como status 3 (paused). Nesse estado, o agente precisa **qualificar a chamada** antes de poder retomar. O endpoint `POST /agent/work_break/exit` só funciona para pausas manuais, não para ACW.

A 3CPlus exige que o agente chame `POST /agent/call/{call_id}/qualify` com uma `qualification_id` para sair do ACW. Somente após a qualificação o agente volta ao status 1 (idle).

**Correção**: Detectar quando o status 3 é pós-chamada (ACW) vs pausa manual:
- Se acabou de sair de status 2 (on_call) para 3, é ACW → mostrar tela de tabulação
- Se entrou em pausa via botão de intervalo, é pausa manual → mostrar botão Retomar

### 3. Sem tela de tabulação após chamada
Atualmente, quando a chamada termina e o agente entra em ACW (status 3), o dashboard mostra a mesma tela de "Aguardando" com botão Retomar. Deveria mostrar uma tela de tabulação com as qualificações da campanha.

**Correção**: Adicionar estado `isACW` que é setado quando o status transiciona de 2→3. Nesse estado, renderizar uma tela de tabulação com as qualificações disponíveis. Ao selecionar uma qualificação, chamar `qualify_call` no proxy, e o agente volta automaticamente ao idle.

## Mudanças

### 1. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

**Persistir campaign_id no login** (handleCampaignLogin):
- Salvar `selectedCampaign` em `sessionStorage` como `3cp_campaign_id`

**Corrigir myCampaignId** (linha 442):
- Fallback: `myAgent?.campaign_id || sessionStorage.getItem("3cp_campaign_id")`

**Detectar ACW vs pausa manual**:
- Novo state: `previousStatus` para rastrear transição de status
- `isACW = isPaused && previousStatus === 2` (veio de ligação)
- `isManualPause = isPaused && previousStatus !== 2`

**Rastrear última chamada para tabulação**:
- Salvar `lastCallId` e `lastCallPhone` quando `activeCall` existe (status 2)
- Usar na tela de tabulação

**Nova tela de tabulação (ACW)**:
- Renderizar quando `isACW === true` com:
  - Lista de qualificações da campanha (já disponíveis via `campaign_qualifications`)
  - Campo de observação opcional
  - Ao selecionar qualificação → chamar `qualify_call` no proxy
  - Após qualificar → agente volta ao idle automaticamente

**Carregar qualificações da campanha**:
- Ao logar na campanha, buscar qualificações via `campaign_qualifications`
- Armazenar em state `campaignQualifications`

### 2. `supabase/functions/threecplus-proxy/index.ts`

Verificar que `qualify_call` já existe (sim, linha 777-795) — nenhuma mudança necessária no proxy.

## Fluxo corrigido

```text
Operador loga na campanha
  → salva campaign_id em sessionStorage
  → carrega intervalos de pausa ✓
  → carrega qualificações da campanha

Aguardando (status 1)
  → mostra KPIs, histórico, botão Intervalo ✓

Em ligação (status 2)
  → salva call_id para uso posterior
  → mostra tela de atendimento

Pós-chamada / ACW (status 2→3)
  → detecta transição 2→3 = ACW
  → mostra tela de TABULAÇÃO
  → operador seleciona qualificação
  → chama qualify_call
  → agente volta ao status 1

Pausa manual (status 1→3 via intervalo)
  → mostra botão Retomar ✓
  → chama unpause_agent (work_break/exit)
```

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Persistir campaign_id, detectar ACW, tela de tabulação, carregar qualificações |

