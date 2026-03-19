

# Auditoria Funcional + Melhoria Visual da Telefonia

## Parte 1: Auditoria Funcional

### KPIs (Online, Em Ligacao, Em Pausa, Ociosos)
**Status: Funcional.** Os contadores derivam do array `agents` retornado pela API `agents_status`. A logica de mapeamento de status numerico (0=offline, 1=idle, 2=on_call, 3=paused) esta correta. Porem ha um problema: **todos os 5 agentes com status 0 (offline) estao sendo contados como "Online"** porque `onlineCount = agents.length` conta TODOS os agentes retornados pela API, incluindo offline.

**Correcao necessaria:** Filtrar `onlineCount` para excluir agentes com status 0/offline.

### Ligacoes e Acordos dos Operadores
**Status: Funcional com ressalva.** A contagem vem das tabelas `call_dispositions` e `agreements` do dia, cruzadas com `profiles.threecplus_agent_id`. Se os operadores nao tiverem `threecplus_agent_id` configurado no perfil, os contadores ficam em 0 mesmo com atividade real. A API retorna dados reais.

### Tempo dos Operadores
**Status: Funcional.** Usa `status_start_time` da API (Unix timestamp) e calcula elapsed. No `AgentStatusTable` o formato e `Xh Ym` (funcao `formatElapsedTime`).

### Agressividade da Campanha
**Status: Funcional.** O slider chama `update_campaign` via proxy, que faz PATCH na API 3CPlus em `/campaigns/{id}` com `{ dialer_settings: { aggressiveness: value } }`. A API aceita e aplica a mudanca.

### Campanhas - Status
**Status: Bug visual.** Todas as campanhas mostram "Parada" na screenshot, mas a API retorna campanhas sem campo `status` explicito -- usa `paused: false` e `is_on_active_time: true`. O `CampaignOverview` verifica `c.status === "running"`, mas a API nao retorna esse campo. O badge mostra `c.status || "Parada"` e como `c.status` e undefined, sempre mostra "Parada".

**Correcao necessaria:** Derivar status de `paused` e `is_on_active_time`:
- `paused === true` → "Pausada"
- `is_on_active_time === true && !paused` → "Ativa"
- else → "Inativa"

### Campanhas - Progresso/Agentes/Completadas
**Status: Parcialmente funcional.** `campaign_statistics` retorna `data: []` para todas as campanhas (vazio). Isso faz com que progresso=0%, agentes="—", completadas="—". O endpoint pode requerer parametros adicionais (datas) ou o periodo pode nao ter dados. Nenhuma correcao de codigo necessaria -- depende da API ter dados.

## Parte 2: Correcoes Funcionais

### Arquivo: `TelefoniaDashboard.tsx`
1. **Corrigir contagem "Online"** -- filtrar agentes offline:
   ```
   const onlineCount = agents.filter(a => a.status !== 0 && a.status !== "offline").length;
   ```

### Arquivo: `CampaignOverview.tsx`
2. **Corrigir derivacao de status** -- usar `paused` e `is_on_active_time` da API:
   ```
   const isRunning = !c.paused && c.is_on_active_time;
   const statusLabel = c.paused ? "Pausada" : (c.is_on_active_time ? "Ativa" : "Inativa");
   ```

### Arquivo: `AgentStatusTable.tsx`
3. **Filtrar agentes offline** da tabela -- ou agrupa-los separadamente com visual diferente

## Parte 3: Melhoria Visual

### Menu (ThreeCPlusPanel.tsx)
O menu atual e um pequeno DropdownMenu com botao "Menu" discreto. Melhorias:
- Transformar em uma **barra horizontal de tabs** com icones, similar ao padrao do Contact Center WhatsApp
- Usar botoes com fundo primario (laranja) para o tab ativo
- Separar visualmente "Operacional" e "Administrativo" com divisor
- Adicionar icones a cada item (Phone, List, History, BarChart, etc.)

### Dashboard Visual (TelefoniaDashboard.tsx admin view)
- KPI cards: adicionar gradiente sutil e sombra no hover
- Tabela de operadores: aberta por padrao (nao colapsada) ja que e a informacao principal
- Header: badge "Conectado" mais proeminente

### Resumo de alteracoes

| Arquivo | Mudanca |
|---|---|
| `TelefoniaDashboard.tsx` | Corrigir `onlineCount` para excluir offline |
| `CampaignOverview.tsx` | Derivar status de `paused`/`is_on_active_time` ao inves de `c.status` |
| `ThreeCPlusPanel.tsx` | Redesign do menu: barra horizontal com icones e visual padrao do sistema |
| `AgentStatusTable.tsx` | Abrir colapsavel por padrao, melhorar visual |

