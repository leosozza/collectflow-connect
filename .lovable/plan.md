

# Painel de Detalhes do Agente -- Supervisao Completa

Transformar o botao simples de "Spy" em um painel completo de supervisao por agente, acessivel ao clicar no nome/linha do agente na tabela. O painel consolida todas as informacoes e acoes de monitoramento em um unico lugar.

---

## O que muda

Ao clicar em um agente na tabela de status, abre um **Sheet (painel lateral)** com 4 secoes:

### 1. Cabecalho do Agente
- Avatar com iniciais, nome, status atual (badge animado), campanha, tempo no status
- Botoes de acao rapida: Espionar Chamada, Deslogar

### 2. Aba "Escuta" (Spy melhorado)
- **Escutar Chamada**: o spy atual (ouvir a ligacao em andamento, informando ramal/telefone)
- **Escutar Ambiente (Whisper)**: usa a mesma API de spy do 3CPlus mas com modo de escuta passiva -- permite ouvir o microfone do agente mesmo sem chamada ativa (nota: depende da configuracao do 3CPlus; a API de spy ja suporta isso se o agente estiver logado)
- Indicador visual de status: "Em ligacao" (pode espionar) vs "Ocioso" (pode escutar ambiente)

### 3. Aba "Performance" (dados da API 3CPlus)
- Busca o relatorio individual do agente via `agents_report` filtrado por agente e data
- Metricas exibidas em mini-cards:
  - Tempo logado
  - Tempo em ligacao
  - Tempo em pausa
  - Tempo ocioso
  - Quantidade de ligacoes
  - TMA (Tempo Medio de Atendimento)
- Busca o historico de chamadas do agente via `calls_report` filtrado pelo agent_id
- Mini-tabela com as ultimas 10 chamadas do dia (telefone, duracao, status, horario)

### 4. Aba "Atividade" (rastreamento na plataforma CollectFlow)
Nova tabela no banco de dados para registrar a atividade dos operadores dentro da plataforma:

- **Tabela `user_activity_logs`**: registra navegacao entre paginas, cliques em botoes chave, e insercoes de dados
- **Hook `useActivityTracker`**: registra automaticamente mudancas de rota e interacoes principais (inserir cliente, salvar acordo, tabulacao de chamada, etc.)
- Exibe no painel:
  - Horario do primeiro acesso (login do dia)
  - Horario do ultimo acesso
  - Paginas visitadas com timestamps
  - Acoes realizadas (inseriu dados, salvou acordo, tabulou chamada)
  - Indicador de "ativo/inativo" baseado na ultima atividade (se faz mais de X minutos sem acao, marca como inativo)
  - Timeline visual das atividades do dia

---

## Detalhes Tecnicos

### Nova tabela: `user_activity_logs`

```text
id              uuid PK default gen_random_uuid()
tenant_id       uuid NOT NULL
user_id         uuid NOT NULL
activity_type   text NOT NULL  -- 'page_view', 'action', 'login', 'logout'
page_path       text           -- '/cadastro', '/atendimento', etc
action_detail   text           -- 'criou_cliente', 'salvou_acordo', etc
metadata        jsonb default '{}'
created_at      timestamptz default now()
```

RLS: admins do tenant podem ver todas as atividades; operadores veem apenas as proprias.

### Arquivos novos:

1. **`src/hooks/useActivityTracker.ts`**
   - Escuta mudancas de rota (`useLocation` do react-router)
   - Registra page_view a cada navegacao
   - Exporta funcao `trackAction(type, detail)` para registrar acoes manuais
   - Debounce de 5 segundos para evitar spam de registros
   - Registra login/primeiro acesso do dia

2. **`src/components/contact-center/threecplus/AgentDetailSheet.tsx`**
   - Sheet lateral que recebe o agente selecionado
   - Tabs internas: Escuta | Performance | Atividade
   - Aba Escuta: reformula o SpyButton atual como formulario inline (nao dialog)
   - Aba Performance: chama `agents_report` e `calls_report` filtrados pelo agente
   - Aba Atividade: consulta `user_activity_logs` vinculando o agente 3CPlus ao usuario do sistema (por nome ou mapeamento)

### Arquivos modificados:

3. **`src/components/contact-center/threecplus/AgentStatusTable.tsx`**
   - Adiciona `onClick` na TableRow para abrir o AgentDetailSheet
   - Cursor pointer na linha
   - Remove o SpyButton inline (migra para dentro do Sheet)

4. **`src/components/contact-center/threecplus/AgentStatusTable.tsx`** ou **`TelefoniaDashboard.tsx`**
   - Gerencia o estado do agente selecionado e a abertura do Sheet

5. **`supabase/functions/threecplus-proxy/index.ts`**
   - Nao precisa de novas actions -- os endpoints `agents_report` e `calls_report` ja suportam filtro por `agent_id`
   - A action `spy_agent` ja existe e sera reutilizada

6. **`src/App.tsx`** ou **`src/components/AppLayout.tsx`**
   - Integra o hook `useActivityTracker` no layout principal para rastrear navegacao automaticamente

7. **`src/components/atendimento/DispositionPanel.tsx`**, **`src/components/clients/ClientForm.tsx`**, **`src/components/acordos/AgreementForm.tsx`**
   - Adiciona chamadas `trackAction()` em pontos chave (salvar tabulacao, criar cliente, criar acordo)

### Mapeamento agente 3CPlus <-> usuario CollectFlow:
- Busca por correspondencia de nome (`agent.name` do 3CPlus com `profiles.full_name`)
- Se nao encontrar correspondencia, a aba Atividade mostra mensagem "Vincule este agente a um usuario do sistema"
- Futuro: campo `threecplus_agent_id` na tabela profiles para mapeamento direto

### Sem novas dependencias -- usa Sheet, Tabs, Badge, Table e componentes UI existentes.

