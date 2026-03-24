

# Plano: Mapear status 6, mostrar nome da pausa e botao de retomar

## Problema

A API retorna `status: 6` para "Em Intervalo" (work break), mas o dashboard so mapeia status 0-5. Resultado: o banner mostra "6" em vez de "Em Intervalo", nao mostra o nome da pausa, e nao exibe botao para sair da pausa.

Dados da API confirmam: `{"id":100707,"name":"Vitor Santana","status":6,"status_start_time":1774359007}` — sem campo `pause_name` no payload.

## Correcoes em `TelefoniaDashboard.tsx`

### 1. Mapear status 6 nas funcoes de label/cor/bg

- `statusLabel`: status 6 → "Em Intervalo"
- `statusColor`: status 6 → `bg-amber-500`
- `statusBgClass`: status 6 → `bg-amber-500 text-white`

### 2. Incluir status 6 nas derivacoes booleanas

- `isManualPause` (linha 773): adicionar `myAgent?.status === 6` — status 6 e sempre work break manual
- `isPausedStatus` (linha 774): adicionar `myAgent?.status === 6`
- `isPaused` (linha 875): adicionar `myAgent?.status === 6`

### 3. Detectar nome da pausa quando ativada externamente

A API `agents_status` nao retorna `pause_name`. Quando o agente esta em status 6 e `activePauseName` esta vazio (pausa ativada fora do RIVO), buscar o nome do intervalo ativo chamando `agent_work_break_intervals` e cruzando com o estado do agente. Se nao for possivel determinar o nome exato, mostrar "Em Intervalo" como fallback generico.

Adicionar um `useEffect` que detecta status 6 sem `activePauseName` e seta `activePauseName` a partir dos intervalos ja carregados ou com texto generico.

### 4. Botao "Retomar" aparece automaticamente

Com status 6 incluido em `isManualPause`, o bloco de codigo na linha 1173-1183 ja renderiza o botao "Retomar" que chama `handleUnpause` (que faz `unpause_agent` na 3CPlus). Nenhuma mudanca adicional necessaria nesse bloco.

### 5. AgentStatusTable — mapear status 6

No `AgentStatusTable.tsx`, adicionar status 6 ao `numericStatusMap`:
```
6: "work_break"
```
E ao `statusConfig`:
```
work_break: { label: "Em Intervalo", variant: "secondary" }
```

## Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Mapear status 6 em label/cor/bg; incluir em isPaused/isManualPause/isPausedStatus; detectar nome da pausa para pausas externas |
| `src/components/contact-center/threecplus/AgentStatusTable.tsx` | Mapear status 6 como "Em Intervalo" |

