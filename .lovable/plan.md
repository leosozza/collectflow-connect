

## Plano: Redesign do Dashboard de Telefonia (Admin) no estilo 3CPlus

### Contexto

A tela atual do Dashboard admin em `/contact-center/telefonia` possui 6 KPI cards + grid de agentes em cards + campanhas em cards. O usuario quer um layout inspirado no print da 3CPlus: KPIs resumidos no topo, lista de operadores colapsavel, e campanhas em formato de tabela com progresso/completamento.

### Alteracoes

---

#### 1. Redesign do Admin View no `TelefoniaDashboard.tsx`

**KPI Cards** — manter apenas 4 cards principais:
- Online, Em Ligacao, Em Pausa, Ociosos
- Layout `grid-cols-4` com estilo similar ao print (valor grande + label pequeno)
- Remover "Ativas" e "Completadas" do grid principal (podem ficar como resumo secundario)

**Secao Operadores** — colapsavel com `Collapsible`:
- Inicialmente fechado (`defaultOpen={false}`)
- Header: "Operadores (N)" com seta de toggle
- Formato de **tabela/lista** (nao cards) com colunas:
  - Nome completo
  - Status (badge colorido)
  - Ligacoes do dia (do `agentMetrics.contacts`)
  - Acordos do dia (do `agentMetrics.agreements`)
  - Tempo no discador (do `status_start_time` ou `status_time`)
  - Botao de logout
- Manter o clique no agente para abrir o `AgentDetailSheet`

**Secao Campanhas** — formato tabela similar ao print da 3CPlus:
- Colunas: Nome, Progresso (barra), Completamento (%), Agentes, Ociosidade Media
- Slider de agressividade e botao pausar/retomar inline
- Usar `CampaignOverview` refatorado ou substituir por tabela

---

#### 2. Botao "Voltar" no `ThreeCPlusPanel.tsx`

Quando `activeTab !== "dashboard"`, exibir um botao "← Dashboard" no topo de cada sub-pagina que volta para `setActiveTab("dashboard")`.

Adicionar ao componente de cada tab um header com:
```text
[← Dashboard]  Titulo da Tab
```

Isso sera feito passando um `onBack` prop ou renderizando o botao diretamente no `ThreeCPlusPanel` acima de cada `TabsContent`.

---

#### 3. Verificacao de funcionalidades admin conectadas ao 3CPlus

As funcoes administrativas ja invocam o `threecplus-proxy`:
- **Campanhas**: `pause_campaign`, `resume_campaign`, `update_campaign` (agressividade) — conectados
- **Qualificacoes**: `list_qualifications`, `create_qualification` — conectados
- **Equipes**: `list_teams` — conectado
- **Usuarios**: `list_users` — conectado
- **Mailing**: `upload_mailing` — conectado
- **Bloqueio**: `list_blocklist`, `add_to_blocklist` — conectado
- **Rotas/Receptivo/Horarios**: `list_routes`, `list_queues`, `list_office_hours` — conectados

Todas as acoes de criacao/edicao feitas no Rivo chamam o proxy que repassa para a API 3CPlus. **Ja estao funcionais.** Nenhuma alteracao necessaria aqui.

---

### Resumo dos Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Redesign da admin view: 4 KPIs + operadores colapsaveis em lista + campanhas em tabela |
| `src/components/contact-center/threecplus/ThreeCPlusPanel.tsx` | Adicionar botao "← Dashboard" nas sub-paginas |
| `src/components/contact-center/threecplus/CampaignOverview.tsx` | Refatorar para formato de tabela com progresso/completamento |
| `src/components/contact-center/threecplus/AgentStatusTable.tsx` | Refatorar de grid de cards para formato de lista/tabela colapsavel |

