

# Plano: Corrigir endpoints de Pausa/Retomar + Mostrar nome da pausa ativa

## Causa raiz

O proxy está chamando endpoints **incorretos** da API 3CPlus:

| Ação | Proxy chama (ERRADO) | API 3CPlus real (CORRETO) |
|---|---|---|
| Pausar | `POST /agent/pause` | `POST /agent/work_break/{work-break-id}/enter` |
| Retomar | `POST /agent/unpause` | `POST /agent/work_break/exit` |

O erro "O recurso requisitado não foi encontrado" (404) é a API 3CPlus respondendo que `/agent/unpause` não existe.

## Correções

### 1. `supabase/functions/threecplus-proxy/index.ts` — Fix endpoints

**`pause_agent` (linha 736-753):**
- Mudar URL de `POST /agent/pause` para `POST /agent/work_break/{interval_id}/enter`
- Remover o body `{ work_break_interval_id }` pois o ID vai na URL

**`unpause_agent` (linha 755-769):**
- Mudar URL de `POST /agent/unpause` para `POST /agent/work_break/exit`

### 2. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` — Mostrar pausa ativa

Quando `myAgent?.status === 3` (paused), o sistema deve mostrar:
- O **nome do intervalo de pausa** atual (ex: "Almoço", "Banheiro")
- O **tempo decorrido** da pausa (já existe `timerSeconds` baseado em `status_start_time`)

A API `agents_status` retorna apenas `status` e `status_start_time`, sem o nome da pausa. Para resolver:
- Guardar o nome do intervalo selecionado em estado local (`activePauseName`) quando `handlePause` é chamado
- Persistir em `sessionStorage` para sobreviver a refresh
- Exibir na barra de status: "Em pausa: Almoço (05:23)" ao invés de apenas "Em pausa"

### 3. Nova ação `get_agent_work_break_intervals` no proxy

Adicionar suporte ao endpoint `GET /agent/work_break_intervals` que retorna os intervalos disponíveis para o agente logado na campanha. Isso complementa o carregamento atual via `list_work_break_group_intervals`.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Fix URLs de pause/unpause para endpoints corretos da API 3CPlus |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Guardar e exibir nome da pausa ativa + tempo |

