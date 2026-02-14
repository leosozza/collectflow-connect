
# Reorganizacao de Navegacao, Permissoes e Dashboards

## Resumo

Reestruturar a navegacao do sistema, remover paginas desnecessarias, e redesenhar os dashboards de Admin e Operador com separacao clara de permissoes. Criar uma nova pagina de Analytics estilo Power BI exclusiva para admins.

---

## 1. Remocoes e Movimentacoes no Menu

### Remover do menu e das rotas:
- **Financeiro** (`/financeiro`): remover completamente do menu lateral e da rota no App.tsx
- **Acordos** do menu Admin: remover do `postContactItems` (admin)

### Mover funcionalidades:
- **Relatorios**: remover do menu lateral; adicionar como botao "Relatorios" no header do Dashboard Admin (ao lado dos filtros)
- **Acordos**: adicionar ao menu lateral para **operadores** (nao mais para admin)

### Arquivos afetados:
- `src/components/AppLayout.tsx` - reestruturar `postContactItems` e adicionar item Acordos para operadores
- `src/App.tsx` - remover rota `/financeiro`, manter `/acordos` e `/relatorios` (relatorios acessivel via botao)

---

## 2. Dashboard Admin - Tela Principal (Simplificado)

Redesenhar `AdminDashboardPage.tsx` para mostrar apenas:

1. **Total Projetado** (hero card existente)
2. **Vencimentos** (strip com navegacao por data - quantidade + valor)
3. **3 cards**: Recebidos | Quebra | Pendentes
4. **Tabela Desempenho por Operador** (resumida)
5. **Botao "Analytics"** abaixo da tabela -> navega para `/analytics`

Remover do dashboard principal:
- Graficos de pizza e barras (movem para Analytics)
- KPIs avancados (movem para Analytics)
- Cards de percentuais
- Cards de comissao

---

## 3. Nova Pagina Analytics (`/analytics`)

Criar `src/pages/AnalyticsPage.tsx` com painel estilo Power BI:

- **Filtros**: Periodo (ano/mes), Operador, Credor
- **Graficos**:
  - Evolucao mensal (linha) - reutilizar logica do EvolutionChart
  - Taxa de conversao por operador (barras horizontais)
  - Distribuicao de status (pizza: Pago/Quebrado/Pendente)
  - Top 5 maiores devedores (tabela)
  - Heatmap de vencimentos por dia do mes (grid de celulas coloridas)
- **Indicadores (KPIs)**:
  - Taxa de recuperacao
  - Ticket medio
  - Tempo medio de cobranca
- **Design**: Cards com graficos interativos, paleta cinza escuro/branco/laranja, grid responsivo
- Botoes de exportar Excel e imprimir PDF (reutilizar logica de RelatoriosPage)

### Arquivos:
- `src/pages/AnalyticsPage.tsx` (novo)
- `src/App.tsx` - adicionar rota `/analytics` protegida

---

## 4. Dashboard Operador - Tela Principal

Manter `DashboardPage.tsx` mostrando apenas dados proprios:

1. **Total Projetado** (ja existe)
2. **Vencimentos** com navegacao por data (ja existe)
3. **3 cards**: Recebidos | Quebra | Pendentes (ja existem)
4. **Tabela "Meus Clientes"** - renomear secao de vencimentos para "Meus Clientes"

Remover (se existir):
- Cards de percentuais e comissao (mover para perfil ou remover)
- GoalProgress (mover ou remover conforme simplificacao)

---

## 5. Regras de Exibicao

- **Admin**: Dashboard simplificado + botao Analytics + acesso a `/analytics`
- **Operador**: Dashboard apenas com seus dados, sem botao Analytics, sem desempenho de outros

---

## Detalhes Tecnicos

### Arquivos a criar:
- `src/pages/AnalyticsPage.tsx`

### Arquivos a modificar:
- `src/components/AppLayout.tsx` - reorganizar menu (remover Financeiro, mover Acordos para operador, remover Relatorios do menu)
- `src/App.tsx` - remover rota `/financeiro`, adicionar rota `/analytics`
- `src/pages/AdminDashboardPage.tsx` - simplificar para 4 cards + tabela + botao Analytics
- `src/pages/DashboardPage.tsx` - simplificar, renomear secao para "Meus Clientes"
- `src/pages/Index.tsx` - manter logica existente (admin vs operador)

### Componentes reutilizados na Analytics:
- `EvolutionChart` (grafico de evolucao mensal)
- `OperatorRanking` (ranking de operadores)
- `ReportFilters` (filtros)
- `KPICards` (indicadores)
- Recharts: PieChart, BarChart, LineChart para os novos graficos

### Sequencia de implementacao:
1. Modificar `AppLayout.tsx` (menu)
2. Modificar `App.tsx` (rotas)
3. Simplificar `AdminDashboardPage.tsx`
4. Simplificar `DashboardPage.tsx`
5. Criar `AnalyticsPage.tsx` com todos os graficos e indicadores
