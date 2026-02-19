

# Construtor Visual de Fluxos de Cobranca + Motor de Execucao

## Resumo

Implementacao completa de um construtor visual de fluxos no estilo N8N usando React Flow, integrado na pagina de Automacao como nova aba "Fluxos". Inclui o motor de execucao via backend function e CRON job para processar os fluxos criados.

---

## Fase 1 — Banco de Dados

### Tabela `workflow_flows`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| tenant_id | uuid NOT NULL | Isolamento multi-tenant |
| name | text NOT NULL | Nome do fluxo |
| description | text DEFAULT '' | Descricao |
| is_active | boolean DEFAULT false | Liga/desliga execucao |
| nodes | jsonb DEFAULT '[]' | Array de nos do React Flow |
| edges | jsonb DEFAULT '[]' | Array de conexoes |
| trigger_type | text NOT NULL | 'overdue', 'agreement_broken', 'first_contact' |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

### Tabela `workflow_executions`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| tenant_id | uuid NOT NULL | |
| workflow_id | uuid NOT NULL (FK workflow_flows) | |
| client_id | uuid NOT NULL (FK clients) | |
| current_node_id | text | ID do no atual |
| status | text DEFAULT 'running' | 'running', 'waiting', 'done', 'error' |
| execution_log | jsonb DEFAULT '[]' | Historico de cada no executado |
| next_run_at | timestamptz | Para nos "Aguardar X dias" |
| started_at | timestamptz DEFAULT now() | |
| completed_at | timestamptz | |
| error_message | text | |
| created_at | timestamptz DEFAULT now() | |

### RLS
- Ambas as tabelas: admins do tenant podem gerenciar (ALL), usuarios do tenant podem visualizar (SELECT)
- Trigger `update_updated_at_column` em `workflow_flows`

---

## Fase 2 — Construtor Visual (Frontend)

### Dependencia
- Instalar `reactflow` via bun

### Novos arquivos

**`src/services/workflowService.ts`**
- CRUD para `workflow_flows`: fetchWorkflows, createWorkflow, updateWorkflow, deleteWorkflow
- Leitura de `workflow_executions`: fetchExecutions, fetchExecutionStats

**`src/components/automacao/workflow/WorkflowCanvas.tsx`**
- Componente principal com React Flow canvas
- Inicializacao com nodes/edges do banco ou vazio
- Controles de zoom, minimap
- onNodesChange, onEdgesChange, onConnect handlers
- Botoes: Salvar, Ativar/Desativar, Voltar

**`src/components/automacao/workflow/WorkflowSidebar.tsx`**
- Painel lateral esquerdo com nos arrastáveis organizados por categoria:
  - **Gatilhos** (azul): Fatura Vencida, Acordo Quebrado, Sem Contato
  - **Acoes** (verde): Enviar WhatsApp, Enviar SMS, Aguardar, Agente IA, Atualizar Status
  - **Condicoes** (amarelo): Score Propensao, Valor Divida

**`src/components/automacao/workflow/WorkflowNodeProperties.tsx`**
- Sheet/painel lateral direito que abre ao clicar em um no
- Formulario dinamico com campos especificos por tipo de no:
  - trigger_overdue: campo "dias de atraso"
  - action_whatsapp: campo "template da mensagem"
  - action_wait: campo "dias para aguardar"
  - condition_score: campo "score minimo"
  - etc.

**`src/components/automacao/workflow/nodes/`** (custom nodes)
- `TriggerNode.tsx` — no com borda azul, icone de raio
- `ActionNode.tsx` — no com borda verde, icone de engrenagem
- `ConditionNode.tsx` — no losango amarelo, com 2 handles (Sim/Nao)

**`src/components/automacao/workflow/WorkflowListTab.tsx`**
- Lista de todos os fluxos do tenant
- Cards com nome, trigger_type, status ativo/inativo
- Botoes: Editar (abre canvas), Duplicar, Excluir
- Botao "Novo Fluxo" abre canvas vazio
- Mini dashboard de execucoes (ativas, com erro, concluidas)

### Integracao na AutomacaoPage
- Nova aba "Fluxos" no TabsList existente
- TabsContent renderiza `WorkflowListTab` ou `WorkflowCanvas` conforme estado

### Roteamento
- Manter na mesma rota `/automacao` (controle por estado interno da aba, sem rota separada)

---

## Fase 3 — Motor de Execucao (Backend)

### Edge Function `workflow-engine/index.ts`
- Recebe: `{ workflow_id, client_id, trigger_type, trigger_data }`
- Carrega workflow do banco (nodes + edges)
- Faz ordenacao topologica dos nos a partir do trigger
- Executa no por no:
  - **action_whatsapp**: chama `evolution-proxy` internamente para enviar mensagem
  - **action_sms**: chama `threecplus-proxy` para SMS
  - **action_wait**: cria registro em `workflow_executions` com `next_run_at` e status 'waiting', para execucao
  - **action_ai_negotiate**: chama `chat-ai-suggest` com contexto do cliente
  - **action_update_status**: atualiza `clients.status` diretamente
  - **condition_score/value**: avalia condicao e segue pela edge correta (Sim/Nao)
- Registra cada passo no `execution_log`
- Em caso de erro, marca status='error' com mensagem

### Edge Function `workflow-resume/index.ts`
- Funcao chamada pelo CRON
- Busca `workflow_executions` onde `next_run_at <= now()` e `status = 'waiting'`
- Para cada uma, chama `workflow-engine` com o estado salvo para retomar a partir do proximo no

### CRON Job
- Usar `pg_cron` + `pg_net` para chamar `workflow-resume` a cada hora
- SQL inserido via insert tool (nao migration, pois contem URLs especificas)

### Integracao com gatilhos existentes
- `auto-break-overdue/index.ts`: apos marcar clientes como "quebrado", buscar workflows ativos com `trigger_type='agreement_broken'` e disparar `workflow-engine` para cada cliente afetado

### config.toml
- Adicionar entries para `workflow-engine` e `workflow-resume` com `verify_jwt = false`

---

## Fase 4 — Painel de Monitoramento

Dentro da aba "Fluxos", abaixo da lista de workflows:
- Cards: Execucoes Ativas, Aguardando, Concluidas, Com Erro (ultimos 30 dias)
- Tabela de execucoes recentes com: workflow name, client CPF, status, no atual, data inicio

---

## Detalhes Tecnicos

### Tipos de nos (nodeTypes no React Flow)

```text
TRIGGERS (handle: source only)
  trigger_overdue     { days: number }
  trigger_broken      {}
  trigger_no_contact  { days: number }

ACTIONS (handle: source + target)
  action_whatsapp     { message_template: string }
  action_sms          { message_template: string }
  action_wait         { days: number }
  action_ai_negotiate { context?: string }
  action_update_status { new_status: string }

CONDITIONS (handles: target + source_yes + source_no)
  condition_score     { operator: '>' | '<', value: number }
  condition_value     { operator: '>' | '<', value: number }
```

### Ordenacao topologica no motor
1. Encontrar no trigger (sem edges de entrada)
2. BFS/DFS seguindo edges
3. Para conditions, seguir edge com `sourceHandle` === 'yes' ou 'no' conforme resultado
4. Parar em action_wait (persistir estado) ou quando nao ha mais edges

### Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| `src/services/workflowService.ts` | Novo |
| `src/components/automacao/workflow/WorkflowCanvas.tsx` | Novo |
| `src/components/automacao/workflow/WorkflowSidebar.tsx` | Novo |
| `src/components/automacao/workflow/WorkflowNodeProperties.tsx` | Novo |
| `src/components/automacao/workflow/WorkflowListTab.tsx` | Novo |
| `src/components/automacao/workflow/nodes/TriggerNode.tsx` | Novo |
| `src/components/automacao/workflow/nodes/ActionNode.tsx` | Novo |
| `src/components/automacao/workflow/nodes/ConditionNode.tsx` | Novo |
| `src/pages/AutomacaoPage.tsx` | Modificar (nova aba) |
| `supabase/functions/workflow-engine/index.ts` | Novo |
| `supabase/functions/workflow-resume/index.ts` | Novo |
| `supabase/functions/auto-break-overdue/index.ts` | Modificar (trigger workflows) |
| Migration SQL | Nova tabela workflow_flows + workflow_executions |

