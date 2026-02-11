

# Fase 4: Notificacoes, Auditoria e KPIs Avancados

## Resumo

Fase 4 transforma o sistema de uma ferramenta operacional em uma plataforma com visibilidade total: notificacoes em tempo real para acao imediata, trilha de auditoria para compliance, e KPIs avancados com metas para gestao de performance.

---

## Sub-Fase 4A: Notificacoes em Tempo Real

### O que muda para o usuario
- Icone de sino no header com badge de contagem de notificacoes nao lidas
- Dropdown com lista de notificacoes recentes ao clicar no sino
- Notificacoes automaticas para:
  - Acordos pendentes de aprovacao (admin)
  - Acordos aprovados/rejeitados (operador que criou)
  - Parcelas vencendo hoje/amanha
  - Novos clientes importados
- Marcar como lida individualmente ou "marcar todas como lidas"
- Pagina `/notificacoes` com historico completo

### Detalhes tecnicos

**Nova tabela `notifications`:**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, warning, success, action
  reference_type TEXT, -- 'agreement', 'client', 'expense'
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

- RLS: usuarios veem apenas suas proprias notificacoes
- Realtime habilitado via `ALTER PUBLICATION supabase_realtime ADD TABLE notifications`
- Componente `NotificationBell` no header do AppLayout
- Hook `useNotifications` com Supabase Realtime para updates ao vivo
- Funcao de banco `create_notification` (SECURITY DEFINER) para criar notificacoes de forma segura

**Novos arquivos:**
```text
src/components/notifications/NotificationBell.tsx
src/components/notifications/NotificationList.tsx
src/hooks/useNotifications.ts
src/services/notificationService.ts
```

---

## Sub-Fase 4B: Auditoria e Logs de Atividade

### O que muda para o usuario
- Nova pagina `/auditoria` (admins) com timeline de acoes
- Registro automatico de toda acao relevante:
  - Cliente criado/editado/excluido
  - Pagamento registrado / quebra registrada
  - Acordo criado/aprovado/rejeitado
  - Despesa adicionada
  - Usuario editado
  - Configuracoes alteradas
- Filtros por usuario, tipo de acao, periodo
- Detalhes da acao (quem, quando, o que mudou)
- Exportacao do log em Excel

### Detalhes tecnicos

**Nova tabela `audit_logs`:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'approve', 'reject', 'payment', 'break'
  entity_type TEXT NOT NULL, -- 'client', 'agreement', 'expense', 'user', 'settings'
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

- RLS: admins do tenant veem todos os logs, operadores veem apenas os proprios
- Servico `auditService.ts` com funcao `logAction()` chamada nos services existentes
- Integracao nos services de client, agreement, finance e users

**Novos arquivos:**
```text
src/pages/AuditoriaPage.tsx
src/services/auditService.ts
```

**Arquivos modificados** (adicionar chamadas de auditoria):
```text
src/services/clientService.ts
src/services/agreementService.ts
src/services/financeService.ts
```

---

## Sub-Fase 4C: Dashboard Avancado com KPIs e Metas

### O que muda para o usuario
- Painel de metas por operador: admin define meta mensal de recebimento
- Barra de progresso visual mostrando % da meta atingida
- KPIs avancados no dashboard admin:
  - Taxa de conversao (acordos propostos vs aprovados)
  - Tempo medio de resolucao (dias entre criacao e pagamento)
  - SLA de cobranca (% parcelas cobradas antes do vencimento)
  - Ticket medio por operador
- Ranking gamificado com medalhas (ouro, prata, bronze)
- Comparativo mes atual vs mes anterior com setas de tendencia

### Detalhes tecnicos

**Nova tabela `operator_goals`:**
```sql
CREATE TABLE operator_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, operator_id, year, month)
);
```

- RLS: admins gerenciam metas, operadores veem as proprias
- Dashboard do operador ganha barra de progresso da meta
- Dashboard admin ganha secao de KPIs avancados
- Calculos feitos no frontend com dados existentes

**Novos arquivos:**
```text
src/components/dashboard/GoalProgress.tsx
src/components/dashboard/KPICards.tsx
src/components/dashboard/TrendIndicator.tsx
src/services/goalService.ts
```

**Arquivos modificados:**
```text
src/pages/AdminDashboardPage.tsx -- adicionar KPIs e metas
src/pages/DashboardPage.tsx -- adicionar barra de progresso da meta
```

---

## Ordem de Implementacao

| Ordem | Modulo | Justificativa |
|-------|--------|---------------|
| 1 | 4A - Notificacoes | Base para alertas das demais funcionalidades |
| 2 | 4B - Auditoria | Registra acoes para compliance e rastreabilidade |
| 3 | 4C - KPIs e Metas | Usa dados existentes + auditoria para metricas avancadas |

---

## Novas Rotas e Menu

```text
Menu lateral (admins):
  - Auditoria     /auditoria      FileText

Header (todos):
  - Sino de notificacoes (icone Bell)
```

---

## Migracoes SQL Totais

Tres novas tabelas: `notifications`, `audit_logs` e `operator_goals`, todas com RLS por tenant_id.
Habilitacao de Realtime para a tabela `notifications`.

---

## Seguranca

- Notificacoes isoladas por user_id + tenant_id, usuario so ve as proprias
- Audit logs protegidos: admins veem tudo do tenant, operadores apenas suas acoes
- Metas gerenciadas apenas por admins
- Funcao SECURITY DEFINER para criacao de notificacoes (evita bypass de RLS)
- Dados de auditoria nunca expostos publicamente

