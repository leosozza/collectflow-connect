

## Plano: Área Administrativa Super Admin Isolada

Este é um projeto grande que será implementado em fases. A primeira fase foca na **infraestrutura** (layout separado, sidebar, rotas) e na **reorganização dos módulos existentes**. Módulos novos (Equipes SA, Treinamentos, Financeiro avançado) serão criados com estrutura básica e expandidos depois.

---

### Fase 1 — Layout e Navegação Separados

**Criar `SuperAdminLayout.tsx`** — layout completamente independente do `AppLayout`:
- Sidebar própria com cores diferenciadas (fundo mais escuro ou accent diferente para distinção visual)
- Sidebar com os itens: Dashboard, Suporte, Gestão de Equipes, Gestão Financeira, Gestão de Inquilinos, Treinamentos e Reuniões, Configurações do Sistema, Relatórios
- Header com título da página, avatar do super admin e botão de logout
- Guard de acesso: se `!isSuperAdmin`, redireciona para `/`

**Atualizar `App.tsx`**:
- Todas as rotas `/admin/*` usarão `SuperAdminLayout` em vez de `AppLayout`
- Novas rotas:
  - `/admin` → Dashboard SA (reutiliza `AdminDashboardPage`)
  - `/admin/suporte` → Suporte (já existe `SupportAdminPage`)
  - `/admin/tenants` → Gestão de Inquilinos (reutiliza `SuperAdminPage`)
  - `/admin/equipes` → Gestão de Equipes SA (nova página)
  - `/admin/financeiro` → Gestão Financeira (nova página)
  - `/admin/treinamentos` → Treinamentos e Reuniões (nova página)
  - `/admin/configuracoes` → Configurações do Sistema (nova página)
  - `/admin/relatorios` → Relatórios e Análises (nova página)

---

### Fase 2 — Páginas dos Módulos

**Páginas novas (estrutura inicial funcional):**

1. **`AdminEquipesPage`** — Gestão de equipes internas do super admin (colaboradores, cargos, permissões por cargo)
2. **`AdminFinanceiroPage`** — Visão financeira dos tenants: MRR, ARR, churn, status de pagamento por tenant, histórico
3. **`AdminTreinamentosPage`** — Agenda de reuniões, calendário, materiais de onboarding, registro de participantes
4. **`AdminConfiguracoesPage`** — Configurações globais do sistema
5. **`AdminRelatoriosPage`** — Relatórios e análises consolidados (crescimento, saúde do sistema)

Cada página terá estrutura básica com layout de cards/tabelas e dados reais quando disponíveis no banco (tenants, agreements, etc.) ou placeholders para expansão futura.

---

### Fase 3 — Remoção do Super Admin do Sidebar Tenant

- Remover os links "Painel Super Admin" e "Suporte" do `AppLayout.tsx` (sidebar dos tenants)
- Super admins acessarão a área admin por `/admin` diretamente

---

### Arquivos criados
- `src/components/SuperAdminLayout.tsx`
- `src/pages/admin/AdminEquipesPage.tsx`
- `src/pages/admin/AdminFinanceiroPage.tsx`
- `src/pages/admin/AdminTreinamentosPage.tsx`
- `src/pages/admin/AdminConfiguracoesPage.tsx`
- `src/pages/admin/AdminRelatoriosPage.tsx`

### Arquivos alterados
- `src/App.tsx` — rotas `/admin/*` com `SuperAdminLayout`
- `src/components/AppLayout.tsx` — remover links SA do sidebar

### Sem alterações de banco de dados nesta fase
Os módulos usarão tabelas existentes (`tenants`, `support_tickets`, `agreements`, `profiles`, etc.). Tabelas para equipes SA e treinamentos serão criadas quando os módulos forem expandidos.

