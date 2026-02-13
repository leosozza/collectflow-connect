

# Plano Completo de Integracao 3CPlus

Analise completa da API 3CPlus baseada na documentacao oficial. Abaixo estao TODOS os recursos disponiveis, organizados por categoria. Os itens marcados com [JA EXISTE] ja estao implementados. Os demais sao novas funcionalidades possiveis.

---

## O que ja temos implementado [JA EXISTE]

- Listar campanhas
- Criar campanha
- Pausar/retomar campanha
- Atualizar campanha (agressividade)
- Listar listas de mailing por campanha
- Criar lista
- Enviar mailing por array
- Status dos agentes (por campanha)
- Deslogar agente
- Chamadas da empresa (company calls)
- Chamadas por campanha
- Estatisticas de campanha (com filtro de data)
- Dashboard em tempo real com KPIs e auto-refresh

---

## Novas Funcionalidades Disponiveis

### GRUPO 1: Gravacoes e Audio de Ligacoes
Endpoints que permitem ouvir gravacoes direto no sistema.

1. **Ouvir gravacao da ligacao** - `GET /calls/:id/recording`
2. **Gravacao AMD (caixa postal)** - `GET /calls/:id/recording_amd`
3. **Gravacao de consulta** - `GET /calls/:id/recording_consult`
4. **Gravacao de transferencia** - `GET /calls/:id/recording_transfer`
5. **Gravacao apos cancelamento de consulta** - `GET /calls/:id/recording_after_consult_cancel`
6. **Download de audio em lote** - `GET /calls/download` (se habilitado)

**O que implementar:** Player de audio integrado na interface para ouvir gravacoes diretamente. Botao "Ouvir" em cada registro de chamada no historico.

---

### GRUPO 2: Espionagem de Agente (Spy)
Permite que supervisores escutem ligacoes em tempo real.

1. **Espionar agente** - `POST /spy` (conecta o supervisor para ouvir a ligacao do agente)

**O que implementar:** Botao "Espionar" na tabela de agentes online, disponivel quando o agente esta em ligacao (status 2). O supervisor recebe a ligacao no ramal configurado.

---

### GRUPO 3: Graficos e Metricas de Campanha
Dados hora a hora para graficos de desempenho.

1. **Metricas graficas** - `GET /campaign/metrics/graphic` (retorna dados por hora: total, atendidas, abandonadas, AMD, nao atendidas, convertidas, DMC)

**O que implementar:** Grafico de chamadas por hora usando Recharts (ja instalado). Comparativo hoje vs ontem. Metricas: total, atendidas, abandonadas, AMD, conversoes.

---

### GRUPO 4: Qualificacoes
Gerenciar listas de qualificacao (tabulacoes) usadas pelos agentes.

1. **Listar qualificacoes** - `GET /qualifications`
2. **Criar lista de qualificacao** - `POST /qualifications`
3. **Atualizar qualificacao** - `PUT /qualifications/:id`
4. **Deletar qualificacao** - `DELETE /qualifications/:id`

**O que implementar:** Aba "Qualificacoes" no painel de telefonia para gerenciar as tabulacoes que os agentes usam ao finalizar ligacoes.

---

### GRUPO 5: Equipes (Teams)
Gerenciar equipes de agentes.

1. **Listar equipes** - `GET /teams` [parcialmente usado]
2. **Criar equipe** - `POST /teams`
3. **Ver equipe** - `GET /teams/:id` (inclui agentes e supervisores)
4. **Atualizar equipe** - `PUT /teams/:id`

**O que implementar:** Painel de gestao de equipes com criacao, edicao e atribuicao de agentes.

---

### GRUPO 6: Relatorio de Agentes da Empresa
Relatorio completo de produtividade dos agentes.

1. **Relatorio de agentes** - `GET /company/agents/report` (tempo logado, tempo em pausa, quantidade de ligacoes, tempo medio, etc.)

**O que implementar:** Relatorio detalhado de produtividade por agente com metricas de tempo.

---

### GRUPO 7: Relatorio de Chamadas da Empresa
Historico detalhado de todas as ligacoes.

1. **Relatorio de chamadas** - `GET /company/calls/report` (com filtros de data, campanha, agente, status)

**O que implementar:** Tabela com historico de chamadas, filtros por periodo/campanha/agente, duracao de cada ligacao, status, e botao para ouvir gravacao.

---

### GRUPO 8: Relatorio Estatistico (Statistics Report)
Relatorios avancados com exportacao.

1. **Relatorio estatistico** - `GET /statistics/report`

**O que implementar:** Dashboard de relatorios com exportacao para Excel.

---

### GRUPO 9: Filas Receptivas
Gerenciar numeros e filas de atendimento receptivo.

1. **Listar filas receptivas** - `GET /receptive_queues`
2. **Criar fila** - `POST /receptive_queues`
3. **URA Receptiva** - `GET/POST /receptive_ivr`
4. **Numeros receptivos** - `GET/POST /receptive_number_setting`

**O que implementar:** Painel de configuracao de filas receptivas e URA.

---

### GRUPO 10: Lista de Bloqueio (Blocklist)
Gerenciar numeros bloqueados (do-not-call).

1. **Listar bloqueios** - `GET /block_lists`
2. **Adicionar numero** - `POST /block_lists`
3. **Remover numero** - `DELETE /block_lists/:id`

**O que implementar:** Tela para gerenciar numeros bloqueados/do-not-call.

---

### GRUPO 11: SMS
Envio de SMS em massa integrado.

1. **Upload mailing SMS** - `POST /mailing_list_sms/upload`
2. **Validar SMS** - `POST /mailing_list_sms/validate`
3. **Criar lista SMS** - `POST /mailing_list_sms`
4. **Listar mailings SMS** - `GET /mailing_list_sms`
5. **Iniciar disparo** - `PUT /mailing_list_sms/:id/start_list`

**O que implementar:** Modulo de envio de SMS em massa com upload de lista.

---

### GRUPO 12: Agendamentos
Gestao de callbacks/agendamentos feitos pelos agentes.

1. **Criar agendamento** - `POST /agent/call/:id/qualify`
2. **Listar agendamentos** - `GET /agent/schedules`
3. **Atualizar agendamento** - `PUT /schedules/:id`

**O que implementar:** Painel de agendamentos com lista de callbacks pendentes.

---

### GRUPO 13: Gestao de Usuarios
Gerenciar agentes e supervisores diretamente.

1. **Listar usuarios** - `GET /users`
2. **Criar usuario** - `POST /users`
3. **Atualizar usuario** - `PUT /users/:id`
4. **Desativar agente** - `GET /users/:id/deactivate`
5. **Dados do usuario** - `GET /user_data/:id`
6. **Listar agentes ativos** - `GET /agents?all=true&status=active`

**O que implementar:** Painel de gestao de usuarios 3CPlus (criar agentes, alterar permissoes, desativar).

---

### GRUPO 14: Rotas 3C
Gerenciar rotas de telefonia.

1. **Listar rotas** - `GET /3c_routes`

**O que implementar:** Visualizacao das rotas disponiveis para fixo e celular.

---

### GRUPO 15: Intervalos e Horarios
Configurar horarios de operacao.

1. **Horario comercial** - `GET /office_hours`
2. **Filtros** - `GET /filter`
3. **Intervalos** - `GET/POST /intervals`

**O que implementar:** Painel de configuracao de horarios de operacao.

---

## Recomendacao de Prioridade

Sugiro implementar na seguinte ordem (maior valor operacional primeiro):

**Prioridade ALTA (impacto imediato na operacao):**
1. Gravacoes de ligacoes (Grupo 1) - ouvir ligacoes direto no sistema
2. Relatorio de chamadas (Grupo 7) - historico com duracao e gravacao
3. Graficos por hora (Grupo 3) - visualizacao de performance
4. Espionagem de agente (Grupo 2) - supervisao em tempo real

**Prioridade MEDIA (gestao e controle):**
5. Relatorio de agentes (Grupo 6) - produtividade
6. Qualificacoes (Grupo 4) - gestao de tabulacoes
7. Lista de bloqueio (Grupo 10) - compliance/do-not-call
8. Gestao de equipes (Grupo 5)

**Prioridade BAIXA (funcionalidades complementares):**
9. Agendamentos (Grupo 12)
10. SMS (Grupo 11)
11. Gestao de usuarios (Grupo 13)
12. Filas receptivas (Grupo 9)
13. Rotas e horarios (Grupos 14 e 15)

---

## Detalhes Tecnicos

### Arquivos a modificar/criar:

**Edge Function** (`supabase/functions/threecplus-proxy/index.ts`):
- Adicionar novos cases no switch para cada endpoint (recording, spy, graphic_metrics, qualifications, teams CRUD, agents_report, calls_report, block_lists, sms, schedules, users CRUD)

**Novos componentes frontend** (em `src/components/contact-center/threecplus/`):
- `CallRecordingsPanel.tsx` - player de audio + historico de chamadas
- `SpyButton.tsx` - botao de espionagem na tabela de agentes
- `CallsChart.tsx` - grafico hora a hora com Recharts
- `QualificationsPanel.tsx` - CRUD de tabulacoes
- `TeamsPanel.tsx` - gestao de equipes
- `AgentsReportPanel.tsx` - relatorio de produtividade
- `CallHistoryPanel.tsx` - historico detalhado (substitui HistoryPanel vazio)
- `BlockListPanel.tsx` - gestao de do-not-call

**Painel principal** (`ThreeCPlusPanel.tsx`):
- Adicionar novas abas para os modulos aprovados

Escolha quais grupos voce quer implementar e aprove o plano. Podemos fazer em etapas.

