

# Plano: Status 3CPlus no topo da ficha + Botão "Fechar Tabulação" + Fluxo TPA correto

## Problema atual

1. **Sem status 3CPlus visível na ficha** — O operador não sabe em qual estado está na 3CPlus enquanto atende o cliente
2. **Sem botão "Fechar Tabulação"** — Após tabular na ficha, o operador fecha o modal mas o sistema continua em pausa porque o `qualifyOn3CPlus` falha silenciosamente (mapa vazio ou callId errado)
3. **Fluxo pós-ligação incorreto** — Ao desligar, a 3CPlus entra em TPA (status 4), mas o RIVO trata como "pausa" genérica. Fechar a ficha não encerra o TPA

## Solução

### 1. `src/pages/AtendimentoPage.tsx` — Banner de status 3CPlus no topo

Adicionar uma barra de status no topo da ficha (antes do ClientHeader) quando `embedded` é true e existe `agentId`:

- Mostra o status atual do agente: **"Em Ligação"**, **"TPA — Pós-atendimento"**, **"Em Pausa"**, **"Ocioso"**
- Cor contextual (verde=ligação, amber=TPA/pausa, cinza=idle)
- Centralizado no topo

Receber nova prop `agentStatus` do `TelefoniaDashboard` via `useAtendimentoModal`.

### 2. `src/pages/AtendimentoPage.tsx` — Botão "Fechar Tabulação"

Adicionar botão proeminente **"Finalizar Tabulação"** que:
- Aparece quando o agente está em TPA/pausa (status 3 ou 4)
- Ao clicar: chama `qualifyOn3CPlus` (se não qualificou ainda) e depois fecha o modal via `closeAtendimento()`
- Se `qualifyOn3CPlus` falha, tenta `unpause_agent` como fallback e fecha
- Após fechar, o agente volta para OCIOSO (status 1)

### 3. `src/hooks/useAtendimentoModal.tsx` — Expor status do agente

Adicionar `agentStatus` ao contexto do modal para que o `AtendimentoPage` possa ler o status atual do agente 3CPlus.

### 4. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` — Passar status ao modal

No `setPauseControls` e no `updateAtendimento`, incluir o status atual do agente.

### 5. `src/pages/AtendimentoPage.tsx` — Nova prop + lógica de fechamento

Nova prop `onCloseDisposition?: () => void` que o `TelefoniaDashboard` passa via modal context. Quando chamada:
1. Tenta qualify na 3CPlus
2. Se falha, tenta unpause
3. Fecha o modal
4. Limpa flags do sessionStorage

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useAtendimentoModal.tsx` | Adicionar `agentStatus` ao state/context + callback `onFinishDisposition` |
| `src/pages/AtendimentoPage.tsx` | Banner de status no topo + botão "Finalizar Tabulação" |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Passar `agentStatus` ao modal context |

