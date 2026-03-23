

# Plano: Mapear status 4 (TPA/ACW) da 3CPlus corretamente no RIVO

## Diagnóstico

A 3CPlus usa **status 4 = ACW (TPA - Tempo Pós-Atendimento)** quando a chamada termina. O RIVO trata ACW como status 3 (paused), mas na verdade são estados distintos:

- **Status 1** = Idle (aguardando)
- **Status 2** = Em ligação
- **Status 3** = Pausa manual (work break)
- **Status 4** = ACW / TPA (pós-atendimento)
- **Status 5** = Manual

O `AgentStatusTable` já mapeia `4: "acw"` corretamente, mas o `TelefoniaDashboard` **ignora status 4 completamente** — só verifica `status === 2` (on_call) e `status === 3` (paused). Resultado: quando a 3CPlus entra em TPA (status 4), o RIVO não reconhece e mostra a tela errada.

## Correções

### 1. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

**Adicionar detecção de status 4 (ACW/TPA):**

- Novo check: `const isACWStatus = myAgent?.status === 4 || s === "acw"`
- Incluir status 4 na condição de `effectiveACW`: `const effectiveACW = isACW || isACWStatus || isACWFallback`
- Remover dependência da transição 2→3 como requisito principal — status 4 é ACW direto

**Atualizar `statusLabel`:**
- Adicionar: `if (status === 4 || s === "acw") return "TPA — Pós-atendimento"`

**Atualizar `statusColor` e `statusBgClass`:**
- Status 4 usa cor amber (mesma de pausa) para consistência visual

**Corrigir transições de status no useEffect:**
- Transição 2→4 = ACW direto (chamada terminou)
- Transição 4→1 = ACW encerrado (qualificação feita)
- Manter transição 2→3 como fallback

**Ajustar `isPaused` check na renderização:**
- A tela de ACW deve renderizar tanto com `isPaused` (status 3) quanto com `isACWStatus` (status 4)

### 2. `src/components/contact-center/threecplus/AgentStatusTable.tsx`

Atualizar label do status 4:
- De `"ACW"` para `"TPA"` para consistência com terminologia 3CPlus

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Reconhecer status 4 como ACW/TPA, atualizar labels e transições |
| `src/components/contact-center/threecplus/AgentStatusTable.tsx` | Renomear label ACW → TPA |

