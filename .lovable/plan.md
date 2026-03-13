

# Ajustes no Super Admin — Limpeza e Reorganização

## Resumo das mudanças solicitadas

1. **AdminUsuariosPage** — Remover listagem de usuários existentes, manter apenas o formulário de criação de novos
2. **SuperAdminPage (Gestão de Tenants)** — Excluir aba "Dashboard Executivo", manter apenas: Resumo Tenants, Empresas, Serviços Contratados
3. **Renomear** "Gestão de Inquilinos" → "Gestão de Clientes" (sidebar, pageTitles, sa_modules)
4. **Permissões e Módulos** — Mover de "Automação e Serviços" para "Configurações"
5. **Agentes Digitais** — Remover do sidebar, rotas e imports
6. **Integrações (AdminConfiguracoesPage)** — Renomear primeira aba de "Geral" para "Asaas"
7. **Relatórios e Análises** — Remover do sidebar, rotas e imports

## Arquivos alterados

### `src/pages/admin/AdminUsuariosPage.tsx`
- Remover a query que lista todos os usuários e a tabela de listagem
- Manter apenas o botão "Novo Usuário" e o Dialog de criação
- Remover o dialog de reset de senha e a lógica associada
- Layout simplificado: card com botão de criação

### `src/pages/SuperAdminPage.tsx`
- Remover `TabsTrigger value="executivo"` e o `TabsContent value="executivo"` com `AdminDashboardPage`
- Remover import do `AdminDashboardPage` (lazy)
- Alterar `defaultValue` para `"dashboard"` (Resumo Tenants)
- Manter abas: Resumo Tenants, Empresas, Serviços Contratados, Novo Cliente

### `src/components/SuperAdminLayout.tsx`
- Mover "Permissões e Módulos" do grupo "Automação e Serviços" para "Configurações"
- Renomear "Gestão de Inquilinos" → "Gestão de Clientes"
- Remover items: "Agentes Digitais" e "Relatórios e Análises"
- Remover rotas correspondentes de `ROUTE_MODULE_MAP` e `pageTitles`
- Atualizar pageTitles: `/admin/tenants` → "Gestão de Clientes"

### `src/pages/admin/AdminConfiguracoesPage.tsx`
- Renomear `TabsTrigger value="geral"` de "Geral" para "Asaas"

### `src/App.tsx`
- Remover rota `/admin/agentes-digitais` e `/admin/relatorios`
- Remover imports: `AdminAgentesDigitaisPage`, `AdminRelatoriosPage`

### Banco de dados (migração SQL)
- Renomear módulo `gestao_inquilinos` → name "Gestão de Clientes"
- Remover módulos: `agentes_digitais`, `relatorios`

