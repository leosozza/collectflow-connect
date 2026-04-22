

## Análise: Gustavo aparece "Em Intervalo: Pausa" no RIVO mas está em TPA na 3CPlus

### Causa raiz

A 3CPlus está retornando para o agente Gustavo `status=3` (paused) no endpoint `/agents/status`, mas internamente ela classifica esse estado como **TPA pós-atendimento** (não uma pausa manual). Por isso:

- O painel da 3CPlus mostra "TPA" (sabe interpretar o contexto pelo `last_call`).
- O RIVO mostra "Em Intervalo: Pausa (21:24)" porque a lógica em `TelefoniaDashboard.tsx` linha 871 classifica qualquer `status===3` como `isManualPause`, e quando não há `activePauseName` na sessão, atribui o label genérico "Pausa" (linha 861).
- Ao clicar **Retomar** → backend chama `unpause_agent` → 3CPlus retorna **"O agente não está em intervalo ou não pode ser removido"** (toast visível na screenshot) porque o estado real é TPA, que só sai com `qualify_call`.

Resultado: o operador fica preso, sem conseguir tabular nem retomar.

### Correção em 3 pontos

#### 1. Detectar TPA disfarçada de pausa (`status=3` sem pause real)

Em `TelefoniaDashboard.tsx`, alterar `isManualPause` para distinguir pausa real de TPA mascarada:

```ts
// Pausa manual REAL: status 3/6 COM identificação de intervalo conhecida
// (intervalo selecionado pelo agente OU status === 6 work_break)
const hasKnownPause = !!sessionStorage.getItem("3cp_active_pause_name");
const hasFinishedCallPending = !!lastFinishedCall || !!sessionStorage.getItem("3cp_last_call_id");

// status=3 sem pausa conhecida + chamada recente = TPA mascarada (não é pausa)
const isTPAMasqueradedAsPause = myAgent?.status === 3 && !hasKnownPause && hasFinishedCallPending;

const isManualPause = (myAgent?.status === 6) || (myAgent?.status === 3 && !isTPAMasqueradedAsPause);
```

E o `effectiveACW` (linha 1009) precisa incluir `isTPAMasqueradedAsPause` para forçar o painel de tabulação a aparecer.

#### 2. Header: rotular como TPA quando for o caso

Linha 1300-1310: priorizar `effectiveACW` (já faz). A correção do item 1 garante que `effectiveACW` será `true` no caso do Gustavo, e a barra ficará **"TPA — Pós-atendimento (21:24)"** em vez de "Em Intervalo: Pausa".

#### 3. Botão Retomar inteligente: tentar `qualify_call` antes de `unpause_agent`

Em `handleUnpause` (linha 756): se a tentativa de unpause retornar **"não está em intervalo"**, fazer fallback automático para `qualify_call` com a primeira qualificação disponível (mesma lógica que já existe em `finishFn` linhas 894-932). Isso quebra o loop em que o operador clica "Retomar" e nada acontece.

Adicionar também o auto-trigger: quando o sistema detectar `isTPAMasqueradedAsPause === true` por mais de 3s, abrir automaticamente o painel de qualificação (já existe `disposition modal` — basta chamar `setIsACW(true)`).

### Logs de diagnóstico (já existem)

Linha 1019 já loga `myAgent.status, isPaused, isTPAStatus, effectiveACW, activePauseName`. Após o fix, o console mostrará para o caso do Gustavo:
```
status:3 isPaused:true isTPAStatus:false isACW:false 
effectiveACW:true activePauseName:""
isTPAMasqueradedAsPause:true
```

### Arquivos alterados

- `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`
  - Adicionar `isTPAMasqueradedAsPause` (após linha 1001).
  - Ajustar `isManualPause` (linha 871) para excluir TPA mascarada.
  - Ajustar `effectiveACW` (linha 1009) para incluir TPA mascarada.
  - Em `handleUnpause` (linha 756): fallback automático para `qualify_call` quando 3CPlus rejeitar com "não está em intervalo".
  - Auto-abrir painel de tabulação quando TPA mascarada for detectada.

### Validação pós-deploy (peça ao Gustavo)

1. Após receber uma chamada e desligar → barra deve mostrar **"TPA — Pós-atendimento (Xs)"**, não mais "Em Intervalo: Pausa".
2. Painel de qualificação abre automaticamente com lista de motivos.
3. Selecionar motivo → tabula via `qualify_call` → volta para "Aguardando ligação" sem ficar preso.
4. Se em algum momento ainda clicar "Retomar" e a 3CPlus rejeitar → fallback automático tabula a chamada com a primeira qualificação válida (escape).

### Fora de escopo

- Mudar config de TPA na 3CPlus (lado do cliente — não temos acesso).
- Refatorar `TelefoniaDashboard.tsx` em componentes menores.

