

# Upgrade do Construtor Visual de Fluxos — Estilo ThotAI

## Resumo

O construtor atual e funcional mas basico: tem poucos tipos de nos, sidebar simples sem busca, painel de propriedades limitado, e falta recursos como undo/redo, simulador de teste, templates, e validacao de fluxo. O objetivo e trazer o nivel de completude do ThotAI, adaptado ao contexto de cobranca.

---

## O que muda

### 1. Arquitetura de Nos Unificada

Substituir os 3 componentes de nos separados (TriggerNode, ActionNode, ConditionNode) por um unico componente `CustomFlowNode` que renderiza qualquer tipo de no dinamicamente, assim como o ThotAI faz. Isso simplifica a manutencao e permite adicionar novos tipos de nos sem criar novos componentes.

**Novo arquivo:** `src/components/automacao/workflow/FlowNodeTypes.ts`
- Definicao centralizada de todos os tipos de nos com icone, cor, categoria e descricao
- Interface `FlowNodeData` completa com todas as propriedades possiveis
- Funcao `getNodeType()` para buscar configuracao por tipo

**Categorias de nos (adaptadas para cobranca):**

| Categoria | Cor | Nos |
|-----------|-----|-----|
| Gatilhos | Azul (#3b82f6) | Fatura Vencida, Acordo Quebrado, Sem Contato, Webhook, Manual |
| Mensagens | Verde (#22c55e) | WhatsApp Texto, WhatsApp Midia, WhatsApp Botoes, SMS, Email |
| Logica | Amarelo (#f59e0b) | Condição Score, Condição Valor, Condição Status, Aguardar Resposta, Delay, Capturar Resposta |
| Acoes | Roxo (#8b5cf6) | Agente IA, Atualizar Status, Criar Acordo, Chamar Webhook, Definir Variavel |
| Controle | Rosa (#ec4899) | Transferir Humano, Encerrar Fluxo, Loop |

**Novo componente:** `src/components/automacao/workflow/nodes/CustomFlowNode.tsx`
- Renderiza qualquer tipo de no com cor e icone da configuracao
- Mostra preview do conteudo (mensagem truncada, valor da condicao, etc.)
- Handles dinamicos: botoes geram handles individuais, condicoes tem Sim/Nao
- Suporte a botoes de acoes inline (duplicar, excluir) no hover

### 2. Sidebar com Busca e Accordion

**Reescrever:** `src/components/automacao/workflow/WorkflowSidebar.tsx`

- Campo de busca no topo para filtrar nos por nome/descricao
- Accordion por categoria (colapsavel)
- Cada no mostra icone + nome + descricao curta
- Drag & drop com visual de arrastar (grip icon)
- Botao de colapsar sidebar para maximizar canvas
- Tooltip com descricao completa ao passar o mouse

### 3. Painel de Configuracao Avancado

**Reescrever:** `src/components/automacao/workflow/WorkflowNodeProperties.tsx`

Transformar de Sheet lateral para painel inline (ao lado do canvas), com:

- Botao de minimizar/expandir
- ScrollArea para conteudo longo
- Campos dinamicos por tipo de no:
  - **WhatsApp Texto:** textarea com preview de variaveis, seletor de instancia
  - **WhatsApp Botoes:** editor de botoes (adicionar/remover, ate 3), cada botao com handle proprio
  - **WhatsApp Midia:** upload de midia ou URL, tipo de midia (imagem/video/audio/documento)
  - **Condições:** operador (>, <, =, !=, contem), valor, campo de comparacao
  - **Delay:** slider + input para minutos/horas/dias
  - **Capturar Resposta:** pergunta, nome da variavel, tipo de validacao, timeout
  - **Webhook:** URL, metodo (GET/POST/PUT), headers, body template, variavel para resposta
  - **Definir Variavel:** nome, valor, escopo (fluxo/cliente)
- Botao "Excluir No" com confirmacao
- Botao "Duplicar No"

### 4. Canvas Melhorado

**Reescrever:** `src/components/automacao/workflow/WorkflowCanvas.tsx`

Adicionar:

- **Undo/Redo** com Ctrl+Z / Ctrl+Shift+Z (hook `useFlowHistory`)
- **Visual de drop zone** ao arrastar nos sobre o canvas (borda + mensagem "Solte aqui")
- **Selecao de edges** com click para destacar e excluir
- **Panel inferior** com dicas de uso ("Arraste blocos da paleta... Conecte arrastando entre nos...")
- **Panel superior contextual** ao selecionar no/edge (mostra nome + botoes Duplicar/Excluir)
- **Confirmacao de exclusao** via AlertDialog (nao mais confirm() nativo)
- **MiniMap colorido** com cores por tipo de no
- **Edges com setas** (MarkerType.ArrowClosed) e estilo customizado
- **Delete key protection** para nao deletar quando digitando em inputs
- **Validacao ao salvar:** verificar se trigger existe, nos orfaos, botoes sem conexao

### 5. Simulador de Teste

**Novo arquivo:** `src/components/automacao/workflow/FlowTestSimulator.tsx`

Painel lateral que simula a execucao do fluxo visualmente:

- Botao "Testar" na toolbar do editor
- Mostra os nos sendo executados em sequencia com highlight
- Para em condicoes e pergunta "Sim ou Nao?"
- Para em "Aguardar Resposta" e permite digitar resposta simulada
- Log de execucao em tempo real
- Highlight do no atual no canvas (borda brilhante)

### 6. Templates de Fluxo

**Novo arquivo:** `src/components/automacao/workflow/FlowTemplates.ts`

Templates pre-definidos para criar fluxos rapidamente:

- **Cobranca Basica:** Trigger Vencida > WhatsApp Lembrete > Aguardar 3 dias > WhatsApp Urgente > Atualizar Status
- **Negociacao Inteligente:** Trigger Vencida > Condicao Score > (Alto) Agente IA > (Baixo) WhatsApp Padrao
- **Recuperacao de Acordo:** Trigger Acordo Quebrado > WhatsApp > Aguardar 7 dias > SMS > Atualizar Status

**Novo arquivo:** `src/components/automacao/workflow/FlowTemplatesDialog.tsx`

Dialog com cards visuais dos templates, botao "Usar Template" que popula o canvas.

### 7. Hook de Historico

**Novo arquivo:** `src/hooks/useFlowHistory.ts`

- Pilha de estados (nodes + edges) com limite de 50 entradas
- Metodos: pushState, undo, redo, canUndo, canRedo
- Detecta mudancas significativas para nao poluir historico

### 8. Lista de Fluxos Melhorada

**Atualizar:** `src/components/automacao/workflow/WorkflowListTab.tsx`

- Adicionar botao "Templates" ao lado de "Novo Fluxo"
- Tabela de execucoes recentes (ultimas 10) com: fluxo, cliente CPF, status, no atual, data
- Filtro por status na lista de fluxos (Todos/Ativos/Inativos)
- Busca por nome de fluxo

---

## Detalhes Tecnicos

### Novos tipos de nos adicionados

```text
GATILHOS (novos)
  trigger_webhook     { webhook_url: string }
  trigger_manual      {}

MENSAGENS (novos)
  action_whatsapp_media    { media_url, media_type, caption }
  action_whatsapp_buttons  { message, buttons: [{id, text}] }
  action_email             { subject, body, to_field }

LOGICA (novos)
  condition_status    { status_values: string[] }
  wait_response       { timeout_seconds, timeout_node_id }
  delay               { delay_minutes }
  input_capture       { question, variable_name, validation_type }
  loop                { max_iterations, exit_condition }

ACOES (novos)
  action_create_agreement  { discount, installments }
  action_webhook           { url, method, headers, body, save_to }
  action_set_variable      { name, value, scope }

CONTROLE (novos)
  transfer_to_human  { department, message }
  end_flow           {}
```

### Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| `src/components/automacao/workflow/FlowNodeTypes.ts` | Novo |
| `src/components/automacao/workflow/nodes/CustomFlowNode.tsx` | Novo (substitui os 3 anteriores) |
| `src/components/automacao/workflow/WorkflowSidebar.tsx` | Reescrever |
| `src/components/automacao/workflow/WorkflowNodeProperties.tsx` | Reescrever |
| `src/components/automacao/workflow/WorkflowCanvas.tsx` | Reescrever |
| `src/components/automacao/workflow/FlowTestSimulator.tsx` | Novo |
| `src/components/automacao/workflow/FlowTemplates.ts` | Novo |
| `src/components/automacao/workflow/FlowTemplatesDialog.tsx` | Novo |
| `src/components/automacao/workflow/WorkflowListTab.tsx` | Atualizar |
| `src/hooks/useFlowHistory.ts` | Novo |
| `supabase/functions/workflow-engine/index.ts` | Atualizar (novos tipos de nos) |

### Nao requer alteracoes no banco de dados

Os campos `nodes` e `edges` ja sao JSONB, entao os novos tipos de nos sao automaticamente suportados. O motor de execucao precisa apenas ser atualizado para processar os novos tipos.

### Compatibilidade

Fluxos existentes continuarao funcionando. O novo `CustomFlowNode` reconhece todos os tipos antigos (trigger_overdue, action_whatsapp, etc.) atraves do mapeamento em `FlowNodeTypes.ts`.

