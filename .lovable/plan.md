

# Plano: Separar estados de chamada ativa e pós-atendimento após hangup

## Causa Raiz

Dois problemas entrelaçados:

1. **`3cp_last_call_id` não é removido no hangup**: O `handleHangup()` na `AtendimentoPage` marca `callHungUp = true` mas **não limpa** `sessionStorage("3cp_last_call_id")`. Isso faz com que `effectiveCallId` (linha 81) continue retornando um valor mesmo após desligar, mantendo `hasActiveCall` como `true` até que a tabulação limpe o ID.

2. **Banner de status não reflete o hangup local**: O `getStatusConfig()` (linha 414) depende exclusivamente de `agentStatus` vindo do polling da 3CPlus. Se o polling ainda não atualizou (atraso de 3-15s), o banner continua mostrando "Em Ligação" (status 2) mesmo após o operador já ter desligado.

3. **Na TelefoniaDashboard**: O `isOnCall` (linha 907) também depende apenas do status do agente via polling, sem considerar se o operador já executou o hangup localmente.

## Fluxo Antigo vs Novo

```text
ANTIGO:
  Operador desliga → setCallHungUp(true)
  → 3cp_last_call_id permanece → effectiveCallId ainda tem valor
  → hasActiveCall = !!effectiveCallId && !callHungUp = false (OK no botão)
  → MAS: banner status continua "Em Ligação" até polling atualizar (3-15s)
  → 3cp_last_call_id só é removido quando qualifyOn3CPlus é chamado

NOVO:
  Operador desliga → setCallHungUp(true)
  → sessionStorage.removeItem("3cp_last_call_id") imediato
  → sessionStorage.setItem("3cp_call_hung_up", "true") (flag para TelefoniaDashboard)
  → Banner muda para "Ligação encerrada — aguardando tabulação"
  → Tabulação usa callId salvo em estado local (não depende mais de sessionStorage para call_id)
  → qualifyOn3CPlus continua funcionando normalmente com o callId em memória
```

## Alterações

### 1. `src/pages/AtendimentoPage.tsx`

**handleHangup** (linhas 388-406): Após sucesso do hangup:
- Salvar `effectiveCallId` em uma ref local (`hungUpCallIdRef`) antes de limpar
- `sessionStorage.removeItem("3cp_last_call_id")`
- `sessionStorage.setItem("3cp_call_hung_up", "true")` — sinaliza para TelefoniaDashboard

**effectiveCallId** (linha 81): Adicionar ref `hungUpCallIdRef` para preservar o call_id para tabulação mesmo após limpar sessionStorage.

**getStatusConfig** (linhas 414-423): Adicionar condição: se `callHungUp === true`, mostrar estado "Ligação encerrada — aguardando tabulação" com ícone `Clock` e cor amber, independente do status do polling.

**dispositionMutation.onSuccess** (linhas 235-256): Usar `hungUpCallIdRef.current` ao invés de `effectiveCallId` para o `qualifyOn3CPlus`, já que o sessionStorage foi limpo. Limpar `hungUpCallIdRef` e `sessionStorage("3cp_call_hung_up")` após tabulação.

### 2. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

**ACW Detection** (linhas 484-526): Respeitar flag `3cp_call_hung_up` do sessionStorage — quando presente, tratar como transição para pós-atendimento mesmo se o polling ainda mostra status 2.

**isOnCall rendering** (linha 1064): Adicionar check: se `sessionStorage.getItem("3cp_call_hung_up")`, não renderizar a tela de "Em ligação" mesmo que o status ainda seja 2.

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/AtendimentoPage.tsx` | Limpar `3cp_last_call_id` no hangup, salvar em ref, novo estado visual pós-hangup |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Respeitar flag `3cp_call_hung_up` para não mostrar "Em ligação" e forçar ACW |

## Regra Oficial

1. Cliente atende → status 2 (Em Ligação)
2. Operador conversa
3. Operador desliga → `handleHangup()` → `3cp_last_call_id` removido, `3cp_call_hung_up` setado, call_id salvo em ref
4. Ficha muda imediatamente para "Ligação encerrada — aguardando tabulação" (sem esperar polling)
5. Operador tabula → `qualifyOn3CPlus` usa call_id da ref → limpa tudo
6. Retorna à fila

## Sem Regressão

- **click2call**: Não afetado — `handleCall` não muda
- **hangup manual**: Melhorado — estado visual reflete imediatamente
- **tabulação após desligar**: Preservada — call_id vive na ref até tabulação
- **ACW/TPA**: Preservado — TelefoniaDashboard força ACW via flag
- **retorno à fila**: Preservado — cleanup completo na tabulação

