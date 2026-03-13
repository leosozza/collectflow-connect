

# Módulo CRM Comercial — Super Admin

## Resumo

Criar um módulo completo de CRM Comercial no Super Admin com Pipeline (Kanban/Lista/Calendário), Leads, Empresas, Atividades, Relatórios, Campos Dinâmicos e Lead Score.

## Banco de Dados (Migrações)

### Tabelas principais

```text
crm_pipeline_stages     → etapas configuráveis do funil (name, position, color)
crm_custom_fields       → campos dinâmicos para leads/empresas/oportunidades
crm_leads               → leads com campos padrão + custom_data JSONB + lead_score
crm_companies           → empresas vinculadas a leads convertidos
crm_opportunities       → oportunidades no pipeline (lead, empresa, etapa, valor, responsável)
crm_activities          → atividades (tipo, data, hora, status, lead_id, company_id)
crm_lead_score_rules    → regras configuráveis de pontuação
```

Todas com isolamento por `sa_user` (sem tenant_id, pois é contexto Super Admin). RLS via `is_super_admin(auth.uid())`.

### Módulos SA

Inserir na `sa_modules`: `comercial_pipeline`, `comercial_leads`, `comercial_empresas`, `comercial_atividades`, `comercial_relatorios`.

## Sidebar (`SuperAdminLayout.tsx`)

Novo grupo **Comercial** com ícone `Target`:

```text
Comercial
  ├── Pipeline de Vendas   → /admin/comercial/pipeline
  ├── Leads                → /admin/comercial/leads
  ├── Empresas             → /admin/comercial/empresas
  ├── Atividades           → /admin/comercial/atividades
  └── Relatórios           → /admin/comercial/relatorios
```

## Rotas (`App.tsx`)

5 novas rotas dentro do bloco `<SuperAdminLayout />`:
- `/admin/comercial/pipeline` → `CRMPipelinePage`
- `/admin/comercial/leads` → `CRMLeadsPage`
- `/admin/comercial/empresas` → `CRMCompaniesPage`
- `/admin/comercial/atividades` → `CRMActivitiesPage`
- `/admin/comercial/relatorios` → `CRMReportsPage`

## Páginas e Componentes

### `/admin/comercial/pipeline` — Pipeline de Vendas
- **3 modos de visualização**: Kanban | Lista | Calendário (toggle no topo)
- **Kanban**: Colunas por etapa, cards arrastáveis (react-beautiful-dnd ou drag nativo), cada card com nome, empresa, responsável, valor, data, lead score badge
- **Lista**: Tabela com filtros (lead, empresa, etapa, responsável, valor, data)
- **Calendário**: Visualização mensal com atividades agendadas
- **Configuração de etapas**: Dialog para CRUD de etapas (nome, cor, ordem) com drag para reordenar
- Barra inferior fixa com totais: Total Pipeline, Conversão, Tickets Ativos (como na imagem)

### `/admin/comercial/leads` — Gestão de Leads
- Tabela de leads com campos padrão + custom fields dinâmicos
- Formulário de criação/edição com campos dinâmicos renderizados automaticamente
- **Lead Score**: Badge colorido (quente/morno/frio) em cada linha
- Botão "Converter em Empresa" para leads qualificados
- **Configuração de campos**: Dialog para CRUD de custom fields (label, tipo, obrigatório, ordem)

### `/admin/comercial/empresas` — Empresas
- Tabela de empresas com campos padrão + custom fields
- Link para o lead de origem
- Formulário com campos dinâmicos

### `/admin/comercial/atividades` — Atividades
- Tabela de atividades com filtros por tipo, status, responsável, data
- Formulário: tipo (Ligação/Reunião/Apresentação/Proposta/Follow-up), responsável, data, hora, status, observações
- Vínculo a lead ou empresa

### `/admin/comercial/relatorios` — Relatórios Comerciais
- KPI cards: Total Leads, Leads Qualificados, Taxa de Conversão, Valor em Negociação, Valor Fechado (estilo da imagem)
- Filtro de período (Últimos 30 Dias / custom)
- Gráficos: distribuição do pipeline por etapa, funil de conversão, origem de leads (pie), performance por vendedor (bar com avatar)
- Botão "Exportar Relatório"

### Campos Dinâmicos (Custom Fields)
- Dialog "Adicionar Novo Campo" (como na imagem): rótulo, tipo de dado, obrigatório, visível na listagem
- Abas por entidade: Leads / Empresas / Oportunidades
- CRUD completo com reordenação

### Lead Score
- Cálculo automático via regras na tabela `crm_lead_score_rules`
- Badge: 🔥 Quente (80-100), 🟡 Morno (50-79), ❄️ Frio (0-49)
- Regras padrão seed: reunião agendada +30, proposta aberta +25, sem resposta 7d -15, etc.
- Tela de configuração de regras acessível via Settings no painel de Leads

## Estrutura de Arquivos

```text
src/pages/admin/comercial/
  CRMPipelinePage.tsx
  CRMLeadsPage.tsx
  CRMCompaniesPage.tsx
  CRMActivitiesPage.tsx
  CRMReportsPage.tsx

src/components/comercial/
  PipelineKanban.tsx
  PipelineList.tsx
  PipelineCalendar.tsx
  PipelineStageConfig.tsx
  LeadForm.tsx
  LeadScoreBadge.tsx
  CompanyForm.tsx
  ActivityForm.tsx
  CRMCustomFieldsConfig.tsx
  CRMReportCharts.tsx
  OpportunityCard.tsx

src/services/
  crmService.ts          (leads, companies, opportunities CRUD)
  crmPipelineService.ts  (stages, drag updates)
  crmActivityService.ts  (activities CRUD)
  crmCustomFieldService.ts
  crmLeadScoreService.ts
```

## Estilo Visual

Seguir paleta existente (primary laranja, cards com sombra suave, badges arredondados). Cards do Kanban com borda esquerda colorida por etapa. KPI cards com ícones em círculos coloridos como nas imagens de referência.

## Faseamento

Dado o tamanho, implementar em ordem:
1. Migração DB + sidebar + rotas
2. Pipeline (Kanban + Lista)
3. Leads + Lead Score
4. Empresas + Atividades
5. Relatórios + Calendário
6. Custom Fields

