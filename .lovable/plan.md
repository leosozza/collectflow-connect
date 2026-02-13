
# Dashboard Completo de Telefonia 3CPlus

## Objetivo
Transformar a pagina de Telefonia (`/contact-center/telefonia`) para que a primeira visualizacao seja um **Dashboard em tempo real** com todos os dados operacionais do discador 3CPlus, eliminando a necessidade de acessar a plataforma do discador separadamente.

## Estrutura das Abas

A pagina de Telefonia tera as seguintes abas (a aba Dashboard sera a default):

1. **Dashboard** (nova - pagina inicial)
2. **Campanhas** (existente)
3. **Enviar Mailing** (existente)
4. **Historico** (existente)

---

## Dashboard - Secoes e Dados

### 1. Cards de KPI (topo)
Metricas principais em cards visuais:
- **Agentes Online** - quantidade de agentes logados
- **Agentes em Ligacao** - agentes com chamada ativa
- **Agentes em Pausa** - agentes em work break
- **Agentes Ociosos** - agentes idle/disponiveis
- **Chamadas Ativas** - total de chamadas em andamento
- **Chamadas Completadas (hoje)** - total de chamadas conectadas

### 2. Tabela de Status dos Agentes
Lista em tempo real de todos os agentes com:
- Nome do agente
- Status atual (online, em ligacao, pausa, ACW, manual)
- Campanha logada
- Tempo no status atual
- Acoes: deslogar agente, alterar pausa

### 3. Campanhas Ativas - Resumo
Para cada campanha ativa:
- Nome e status
- Agentes logados naquela campanha
- Chamadas ativas
- Estatisticas (chamadas completadas, abandonadas, nao atendidas)

### 4. Configuracoes do Discador (por campanha)
- **Agressividade** - visualizacao e controle via PATCH da campanha
- Horario de funcionamento (start_time / end_time)
- Status da campanha (pausar/retomar)

### 5. Botao de Auto-Refresh
- Atualizacao automatica a cada 30 segundos (configuravel)
- Botao manual de refresh

---

## Detalhes Tecnicos

### Edge Function (`threecplus-proxy`)
Adicionar novos actions ao proxy existente:

```text
Novos endpoints a proxiar:
- GET /agents/online          -> action: "agents_online"
- GET /agents/status          -> action: "agents_status"  
- GET /company/calls          -> action: "company_calls"
- GET /campaigns/{id}/calls   -> action: "campaign_calls"
- GET /campaigns/{id}/agents/status -> action: "campaign_agents_status"
- GET /campaigns/{id}/statistics    -> action: "campaign_statistics"
- PATCH /campaigns/{id}       -> action: "update_campaign" (agressividade etc)
- PUT /campaigns/{id}/pause   -> action: "pause_campaign"
- PUT /campaigns/{id}/resume  -> action: "resume_campaign"
- POST /agents/{id}/logout    -> action: "logout_agent"
```

### Novos Componentes Frontend

1. **`TelefoniaDashboard.tsx`** - componente principal do dashboard
   - Gerencia o polling/refresh dos dados
   - Organiza os sub-componentes

2. **`AgentStatusTable.tsx`** - tabela de agentes com status em tempo real
   - Badges coloridos por status (verde=idle, amarelo=pausa, vermelho=ligacao, azul=ACW)
   - Acoes inline (deslogar, mudar pausa)

3. **`CampaignOverview.tsx`** - cards resumo por campanha
   - Estatisticas da campanha
   - Controles de pausar/retomar
   - Slider ou input para agressividade

4. **`DialerControls.tsx`** - painel de controles do discador
   - Agressividade (configuravel por campanha)
   - Horarios de operacao
   - Pause/Resume da campanha

### Modificacoes em Arquivos Existentes

- **`ThreeCPlusPanel.tsx`** - adicionar aba "Dashboard" como default
- **`supabase/functions/threecplus-proxy/index.ts`** - adicionar os novos cases no switch

### Fluxo de Dados

```text
Frontend (polling 30s)
  -> supabase.functions.invoke("threecplus-proxy", { action: "agents_status" })
  -> Edge Function faz GET /agents/status na API 3CPlus
  -> Retorna JSON com status de todos agentes
  -> Frontend renderiza tabela + KPIs
```

### UX
- Indicador visual de "ultima atualizacao" com timestamp
- Toggle para ativar/desativar auto-refresh
- Intervalo configuravel (15s, 30s, 60s)
- Loading skeleton enquanto carrega dados iniciais
- Badge de conexao (online/offline) no topo
