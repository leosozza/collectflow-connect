

# Gatilhos para Acionar Workflows Automaticamente

## Problema Atual

O construtor visual de fluxos ja esta completo (sidebar com busca, nos unificados, simulador, templates, undo/redo, painel de configuracao). Porem, falta a **infraestrutura de gatilhos** para que os fluxos sejam acionados automaticamente. Atualmente, apenas o gatilho "Acordo Quebrado" funciona (via `auto-break-overdue`). Os demais gatilhos (Fatura Vencida, Sem Contato, Webhook, Manual) nao disparam nada.

## O que sera implementado

### 1. Edge Function: `workflow-trigger-overdue`

Nova funcao que roda periodicamente (CRON) para detectar clientes com faturas vencidas e disparar workflows com `trigger_type = 'overdue'`.

- Busca clientes com `data_vencimento` vencida e status diferente de "pago", "quebrado"
- Para cada workflow ativo com trigger_type "overdue", verifica o campo `days` do no trigger
- Compara a diferenca entre hoje e `data_vencimento` com o valor de `days` configurado
- Evita duplicidade: verifica se ja existe execucao ativa (running/waiting) para o par workflow+client
- Chama `workflow-engine` para iniciar a execucao

### 2. Edge Function: `workflow-trigger-no-contact`

Nova funcao (CRON) para detectar clientes sem contato recente.

- Busca clientes ativos cuja ultima interacao (ultimo registro em `message_logs` ou `chat_messages`) foi ha mais de X dias
- Compara com o `days` configurado no no trigger do workflow
- Evita duplicatas da mesma forma
- Dispara `workflow-engine` com `trigger_type = 'first_contact'`

### 3. Endpoint de Webhook: atualizar `workflow-engine`

Modificar o `workflow-engine` para aceitar chamadas externas via webhook:

- Quando `trigger_type = 'webhook'`, aceitar requisicoes com um `webhook_token` no corpo
- Buscar workflows ativos com trigger_type "webhook" e validar o token
- Iniciar execucao para o client_id informado

### 4. Botao "Disparar Manualmente" na UI

Adicionar ao `WorkflowListTab`:

- Botao "Disparar" em cada card de workflow ativo
- Dialog para selecionar o cliente (busca por nome/CPF)
- Chama `workflow-engine` diretamente com o workflow_id + client_id selecionado
- Mostra toast de confirmacao

### 5. Atualizacao do `auto-break-overdue`

Ja existe e funciona. Sem alteracoes necessarias.

### 6. Registro no config.toml

Adicionar entradas para as novas funcoes:
- `workflow-trigger-overdue` (verify_jwt = false)
- `workflow-trigger-no-contact` (verify_jwt = false)

### 7. CRON Jobs

Adicionar via SQL dois novos CRON jobs:
- `workflow-trigger-overdue`: rodar diariamente (1x por dia, de manha)
- `workflow-trigger-no-contact`: rodar diariamente (1x por dia)

---

## Detalhes Tecnicos

### Prevencao de duplicatas

Antes de disparar qualquer workflow, todas as funcoes de trigger verificam:

```text
SELECT count(*) FROM workflow_executions
WHERE workflow_id = ? AND client_id = ? AND status IN ('running', 'waiting')
```

Se ja existir execucao ativa, pula o cliente.

### Fluxo de dados dos gatilhos

```text
CRON (diario)
  |
  +--> workflow-trigger-overdue
  |      |--> Busca clientes com fatura vencida
  |      |--> Para cada: chama workflow-engine
  |
  +--> workflow-trigger-no-contact
         |--> Busca clientes sem contato recente
         |--> Para cada: chama workflow-engine

auto-break-overdue (existente, CRON horario)
  |--> Marca clientes como "quebrado"
  |--> Dispara workflows "agreement_broken"

UI (manual)
  |--> Usuario clica "Disparar"
  |--> Seleciona cliente
  |--> Chama workflow-engine diretamente

Webhook externo
  |--> POST /workflow-engine com trigger_type=webhook
  |--> Valida e inicia execucao
```

### Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/workflow-trigger-overdue/index.ts` | Novo |
| `supabase/functions/workflow-trigger-no-contact/index.ts` | Novo |
| `supabase/functions/workflow-engine/index.ts` | Modificar (webhook support) |
| `src/components/automacao/workflow/WorkflowListTab.tsx` | Modificar (botao disparar manual + dialog cliente) |
| `supabase/config.toml` | Atualizar (novas funcoes) |

### Nao requer alteracoes no banco de dados

As tabelas `workflow_flows` e `workflow_executions` ja suportam todos os campos necessarios.

