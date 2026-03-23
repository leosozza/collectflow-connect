

# Plano: Corrigir tabulação pós-chamada e detecção de ACW

## Diagnóstico

Analisando os logs do console, identifiquei dois problemas principais:

### Problema 1: ACW não é detectado de forma confiável
A detecção de ACW depende de capturar a **transição** de status 2→3 (`previousStatusRef`). Se o polling não capturar o agente em status 2 (a ligação pode ser curta), ou se a página recarrega quando o agente já está em status 3, o `isACW` nunca é setado para `true`. Resultado: a tela de tabulação não aparece.

### Problema 2: Chamada finalizada permanece no `activeCall`
A API `company_calls` retorna chamadas com `status: "4"` (finalizada, com `hangup_time`). O `useMemo` que calcula `activeCall` não filtra por status — encontra qualquer chamada do agente, inclusive finalizadas. Isso não causa bug visual (o `isOnCall` é false), mas polui os logs e desperdiça ciclos.

### Problema 3: `unpause_agent` retorna 422 em ACW
Os logs mostram `3CPlus response: 422` ao tentar `unpause_agent` via `work_break/exit`. Isso é esperado — em ACW, o agente só sai da pausa via `qualify_call`. Mas o botão "Retomar" não mostra erro claro.

## Correções

### `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

**1. Detecção robusta de ACW** — Adicionar fallback: se o agente está em status 3, **não** está em pausa manual (`activePauseName` vazio), e existe uma chamada recente finalizada (`activeCall` com `hangup_time` ou status "4"), considerar como ACW.

```
const isACWFallback = isPaused 
  && !activePauseName 
  && !isACW 
  && (activeCall?.hangup_time || activeCall?.status === "4" || sessionStorage.getItem("3cp_last_call_id"));
const effectiveACW = isACW || isACWFallback;
```

Usar `effectiveACW` no lugar de `isACW` na condição de renderização (linha 920).

**2. Filtrar chamadas finalizadas do `activeCall`** — No `useMemo` que calcula `activeCall` (linha ~770-781), excluir chamadas com `hangup_time` definido ou `status === "4"`:

```
return allCalls.find((c) => 
  (String(c.agent) === agentIdStr || String(c.agent_id) === agentIdStr) 
  && !c.hangup_time 
  && String(c.status) !== "4"
) || null;
```

**Mas** manter uma referência separada `lastFinishedCall` para preencher `lastCallId` e dados de mailing quando em ACW.

**3. Carregar qualificações no fallback de ACW** — Quando `effectiveACW` é true e `campaignQualifications` está vazio, disparar `loadCampaignQualifications` usando o `myCampaignId` do sessionStorage.

**4. Inicializar `previousStatusRef` corretamente** — No primeiro render, se o agente já está em status 3 e `activePauseName` está vazio, iniciar em modo ACW diretamente.

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Detecção robusta de ACW com fallback, filtrar chamadas finalizadas, carregar qualificações automaticamente |

