

## Plano: Redesign da Tela do Operador no estilo 3CPlus + Gestao de Intervalos e Acoes pelo Admin

### Contexto

A tela atual do operador em `/contact-center/telefonia` mostra um card compacto com status, campanha e controles de pausa/login. O usuario quer replicar o layout do 3CPlus: barra de status no topo com botao de intervalo e status da ligacao, dashboard com KPIs visuais (Ligacoes, CPC, Tempo de atendimento, Feedback), tabela de ultimas ligacoes, e transicao automatica para atendimento quando cai uma ligacao.

Alem disso, o admin precisa poder **criar/editar intervalos de pausa** e **editar as acoes de tabulacao** (dispositions) diretamente pelo Rivo, refletindo no 3CPlus.

### Alteracoes Detalhadas

---

#### 1. Redesign completo do Operator View em `TelefoniaDashboard.tsx`

**Estado 1 — Sem campanha (offline):**
- Tela de selecao de campanha (ja existe, manter)

**Estado 2 — Logado na campanha, aguardando ligacao:**

Barra superior fixa:
```text
┌──────────────────────────────────────────────────────────────┐
│ [☕ Intervalo ▼]     Aguardando ligação (00:14)   [🎤] [⌨]  │
└──────────────────────────────────────────────────────────────┘
```
- Botao "Intervalo" com dropdown dos intervalos disponiveis (carregados da campanha via `list_work_break_intervals`)
- Status central: "Aguardando ligacao (MM:SS)" com timer em tempo real
- Botao de microfone (futuro) e dialpad (futuro) como placeholders

Dashboard com 4 cards (grid 2x2):
```text
┌─────────────────────────┐  ┌─────────────────────────┐
│ Ligacoes                │  │ Contato com Pessoa (CPC) │
│ 0  Realizadas hoje      │  │ 0  Contatos hoje         │
│ Ontem: 0                │  │ Ontem: 0                 │
│ [mini grafico do dia]   │  │ [mini grafico do dia]    │
└─────────────────────────┘  └─────────────────────────┘
┌─────────────────────────┐  ┌─────────────────────────┐
│ Tempo de atendimento    │  │ Feedback do gestor       │
│ 00:00 Total             │  │ Nenhuma avaliacao ainda  │
│ • Ligacao 00:00         │  │ [Ver avaliacao]          │
│ • Ocioso  00:00         │  │                          │
└─────────────────────────┘  └─────────────────────────┘
```

Tabela "Ultimas ligacoes":
- Colunas: Telefone, Identificador (nome do cliente), Protocolo, Qualificacao, Data e Hora, Ligar (botao click2call)
- Dados de `call_dispositions` do operador de hoje, enriquecidos com dados do cliente
- Botao "Sair da Campanha" no canto inferior

**Estado 3 — Em ligacao (status 2 / on_call):**
- A barra superior muda para "Em ligacao (MM:SS)" com cor vermelha pulsante
- Abaixo: componente `TelefoniaAtendimento` ja existente (ClientHeader + DispositionPanel + NegotiationPanel + Timeline)
- Manter o comportamento atual que ja funciona

---

#### 2. Timer de status em tempo real

Criar um hook ou logica interna que:
- Captura `myAgent.status_start_time` ou `status_time` 
- Calcula a diferenca com `Date.now()` e atualiza a cada segundo
- Exibe no formato "MM:SS" na barra superior

---

#### 3. Gestao de Intervalos de Pausa pelo Admin

**Proxy — Novos actions em `threecplus-proxy/index.ts`:**
- `create_work_break_interval`: POST `/campaigns/{campaign_id}/intervals` com body `{ name, max_time }`
- `update_work_break_interval`: PUT `/campaigns/{campaign_id}/intervals/{interval_id}` com body
- `delete_work_break_interval`: DELETE `/campaigns/{campaign_id}/intervals/{interval_id}`

**Nova secao no painel admin — `WorkBreakIntervalsPanel.tsx` (novo componente):**
- Acessivel pelo menu admin do `ThreeCPlusPanel` (nova tab "Intervalos")
- Selecionar campanha → listar intervalos existentes
- CRUD: criar, editar nome/tempo maximo, excluir
- Tabela com colunas: Nome, Tempo Maximo, Acoes (editar/excluir)

**Adicionar tab "Intervalos" ao `ThreeCPlusPanel.tsx`:**
- `{ value: "intervals", label: "Intervalos", group: "admin" }`

---

#### 4. Gestao de Acoes de Tabulacao pelo Admin

As acoes de tabulacao (Caixa Postal, Ligacao Interrompida, etc.) sao hoje hardcoded no `DISPOSITION_TYPES` do `dispositionService.ts`. O admin quer poder editar quais acoes aparecem.

**Abordagem — Configuracao via tenant settings:**
- Salvar em `tenant.settings.custom_disposition_types` um array de objetos `{ key, label, color, icon, group }` 
- Se nao existir, usar o `DISPOSITION_TYPES` padrao como fallback
- O `DispositionPanel` lera desse array ao inves do hardcoded

**Nova secao no painel admin — dentro de "Qualificacoes" ou nova tab "Tabulacoes":**
- Listar acoes atuais com drag-to-reorder
- Adicionar/editar: nome, cor, icone, grupo (Agendar/Resultado/Contato)
- Remover acoes
- Salvar no tenant settings
- Mapeamento com 3CPlus ja existe no `ThreeCPlusTab.tsx`

---

#### 5. Tabela de Ultimas Ligacoes do Operador

**Novo componente `OperatorCallHistory.tsx`:**
- Query em `call_dispositions` filtrado por `operator_id = profile.id` e `created_at >= hoje`
- Join com `clients` para obter nome e telefone
- Colunas: Telefone, Nome, Protocolo (id curto), Qualificacao (badge colorido), Data/Hora, Botao Ligar (click2call)

---

### Resumo dos Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Redesign completo do operator view: barra topo + 4 KPI cards + tabela ultimas ligacoes |
| `src/components/contact-center/threecplus/OperatorCallHistory.tsx` | **Novo** — tabela de ultimas ligacoes do operador |
| `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx` | **Novo** — CRUD de intervalos de pausa por campanha |
| `src/components/contact-center/threecplus/ThreeCPlusPanel.tsx` | Adicionar tab "Intervalos" no menu admin |
| `supabase/functions/threecplus-proxy/index.ts` | Novos actions: `create_work_break_interval`, `update_work_break_interval`, `delete_work_break_interval` |
| `src/services/dispositionService.ts` | Suportar `custom_disposition_types` do tenant settings como fallback |
| `src/components/atendimento/DispositionPanel.tsx` | Ler acoes de tabulacao do tenant settings (custom) ao inves de hardcoded |

### Detalhes Tecnicos

- O timer de status usa `useEffect` com `setInterval(1000)` baseado no `status_start_time` do agente
- Os KPIs "Ligacoes" e "CPC" usam dados ja disponíveis em `agentMetrics` (contacts/agreements) + query de `call_dispositions`
- "Tempo de atendimento" calcula soma de tempo em status 2 (ligacao) e status 1 (ocioso) do dia — obtido do agent status ou calculado localmente
- "Feedback do gestor" e placeholder para funcionalidade futura
- Os mini graficos nos cards usam `recharts` (ja instalado) com `AreaChart` compacto
- O proxy 3CPlus para intervalos segue o mesmo padrao RESTful ja usado para qualificacoes, equipes, etc.

