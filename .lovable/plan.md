

# Plano: Correção de ACW e Unpause na integração 3CPlus

## Problema 1: Tabulação não aparece após desligar

**Causa raiz:** A detecção de ACW (linha 492) só dispara quando `prevStatus === 2` e `currentStatus === 3 || 4`. Se a 3CPlus pular direto para status `1` (idle) — o que acontece quando a campanha não tem TPA configurado — o gatilho nunca dispara.

Além disso, a lógica de `effectiveACW` (linha 925) tem uma dependência circular: precisa de `!isManualPause`, mas `isManualPause` inclui status 3 com `activePauseName`, e o ACW fallback exige `!activePauseName`. Quando o agente vai de 2→1 diretamente, nenhum caminho é ativado.

**Correção:**
- No `useEffect` de ACW detection (linha 484-509): adicionar transição `2 → 1` como gatilho de ACW quando existe `lastFinishedCall` ou `sessionStorage("3cp_last_call_id")` e a chamada ainda não foi tabulada
- Forçar `setIsACW(true)` nesse cenário para garantir que a tela de tabulação apareça mesmo sem TPA na 3CPlus

```typescript
// Linha 492-497: ADICIONAR caso 2→1 com chamada pendente
if (prevStatus === 2 && (currentStatus === 3 || currentStatus === 4)) {
  // Caso existente: 2→3/4
  setIsACW(true);
  // ...
}
// NOVO: Caso 2→1 (sem TPA configurado na campanha)
if (prevStatus === 2 && currentStatus === 1) {
  const pendingCall = lastCallId || sessionStorage.getItem("3cp_last_call_id");
  const alreadyQualified = !!sessionStorage.getItem("3cp_qualified_from_disposition");
  if (pendingCall && !alreadyQualified) {
    console.log("[Telefonia] ACW forçado: chamada encerrada sem TPA (2→1)");
    setIsACW(true);
  }
}
```

- Ajustar `effectiveACW` (linha 925) para cobrir o caso de status `1` com ACW forçado:
```typescript
const effectiveACW = (isACW || isACWFallback || isTPAStatus) && !qualifiedFromDisposition && !isManualPause;
```
Quando `isACW === true` e status é `1`, a condição `isPaused || isTPAStatus` na renderização (linha 1052) bloquearia. Precisamos ajustar a condição de renderização para incluir `isACW && myAgent?.status === 1`.

- Na renderização ACW (linha 1052): mudar para:
```typescript
if (effectiveACW && (isPaused || isTPAStatus || isACW))
```

- Limpar corretamente o estado na transição 3/4→1 (linha 499-505): só limpar se `!isACW` (ou seja, se o ACW já foi resolvido pela tabulação, não pela transição automática).

## Problema 2: Erro "operador não está em pausa" ao retomar

**Causa raiz:** O `handleUnpause` (linha 690) chama `unpause_agent` independentemente do status real. Quando o status é `6` (work_break), a 3CPlus pode não aceitar `unpause_agent` — ou o agente já saiu da pausa no servidor antes do frontend detectar.

**Correção:**
- No `handleUnpause`: tratar o erro "não está em pausa" silenciosamente — limpar estado local, fazer `fetchAll()` para sincronizar, e exibir toast de sucesso (já que o objetivo foi alcançado: o agente não está mais em pausa)
- Sincronizar `activePauseName`: no useEffect de status transitions, limpar `activePauseName` quando o status muda para algo diferente de 3/6

```typescript
// handleUnpause — tratar erro "não está em pausa"
const handleUnpause = async () => {
  if (!operatorAgentId) return;
  setUnpausing(true);
  try {
    const result = await invoke("unpause_agent", { agent_id: operatorAgentId });
    const isError = result?.status && result.status >= 400;
    if (isError) {
      const msg = (result.detail || result.message || "").toLowerCase();
      if (msg.includes("não está em pausa") || msg.includes("not paused") || msg.includes("not in pause")) {
        // Agente já saiu da pausa no servidor — limpar estado local
        setActivePauseName("");
        sessionStorage.removeItem("3cp_active_pause_name");
        toast.info("Pausa já encerrada");
      } else {
        toast.error(result.detail || result.message || "Erro ao retomar");
      }
    } else {
      setActivePauseName("");
      sessionStorage.removeItem("3cp_active_pause_name");
      toast.success("Pausa removida");
    }
    fetchAll();
  } catch (err: any) {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("não está em pausa") || msg.includes("not paused")) {
      setActivePauseName("");
      sessionStorage.removeItem("3cp_active_pause_name");
      toast.info("Pausa já encerrada");
      fetchAll();
    } else {
      toast.error(err?.message || "Erro ao retomar");
    }
  } finally {
    setUnpausing(false);
  }
};
```

- Adicionar sincronização automática de `activePauseName` no useEffect de transitions:
```typescript
// Se status mudou de 3/6 para outro valor, limpar pause name
if ((prevStatus === 3 || prevStatus === 6) && currentStatus !== 3 && currentStatus !== 6) {
  setActivePauseName("");
  sessionStorage.removeItem("3cp_active_pause_name");
}
```

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | ACW detection expandida (2→1), handleUnpause resiliente, sync de pause state |

## Verificação esperada

1. Ao desligar chamada com TPA configurado (2→3/4): tela de tabulação aparece (comportamento existente preservado)
2. Ao desligar chamada sem TPA (2→1): tela de tabulação aparece (novo)
3. Ao retomar de pausa quando já saiu no servidor: mensagem "Pausa já encerrada" sem erro
4. Ao retomar de status 6 (work_break): funciona ou degrada graciosamente

