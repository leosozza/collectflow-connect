
## Sistema de Tipos de Usuário com Permissões Granulares

### Contexto e Análise

O sistema hoje possui apenas dois papéis funcionais na tabela `profiles`: `admin` e `operador`, com um terceiro via `tenant_users`: `super_admin`. O pedido é expandir para quatro tipos dentro de um tenant:

- **Admin** — acesso total dentro do tenant
- **Gerente** — visão gerencial: relatórios, analytics, acordos, aprovações, gamificação (gerenciamento), sem acesso a configurações/integrações/cadastros de sistema
- **Supervisor** — como o Gerente, mas com acesso ao Contact Center administrativo (Agente IA, Etiquetas, Respostas Rápidas) e à Carteira completa
- **Operador** — acesso operacional básico: Dashboard (próprio), Carteira (ver/editar negociações), Contact Center (conversas), Gamificação (ver), Acordos (criar/ver)

### Mapeamento de Permissões por Módulo

```text
Módulo / Função             | Admin | Gerente | Supervisor | Operador
----------------------------+-------+---------+------------+---------
Dashboard (próprio)         |  ✅   |   ✅    |    ✅      |   ✅
Dashboard (todos operadores)|  ✅   |   ✅    |    ✅      |   ❌
Gamificação (ver)           |  ✅   |   ✅    |    ✅      |   ✅
Gamificação (gerenciar)     |  ✅   |   ✅    |    ❌      |   ❌
Carteira (ver)              |  ✅   |   ✅    |    ✅      |   ✅
Carteira (criar/importar)   |  ✅   |   ✅    |    ✅      |   ❌
Carteira (excluir)          |  ✅   |   ❌    |    ❌      |   ❌
Acordos (ver/criar)         |  ✅   |   ✅    |    ✅      |   ✅
Acordos (aprovar/rejeitar)  |  ✅   |   ✅    |    ✅      |   ❌
Relatórios                  |  ✅   |   ✅    |    ✅      |   ❌
Analytics                   |  ✅   |   ✅    |    ✅      |   ✅ (filtrado)
Automação                   |  ✅   |   ❌    |    ❌      |   ❌
Contact Center - Conversas  |  ✅   |   ❌    |    ✅      |   ✅
Contact Center - Agente IA  |  ✅   |   ❌    |    ✅      |   ❌
Contact Center - Etiquetas  |  ✅   |   ❌    |    ✅      |   ❌
Contact Center - Resp. Ráp. |  ✅   |   ❌    |    ✅      |   ❌
Telefonia                   |  ✅   |   ❌    |    ✅      |   ✅
Cadastros - Credores        |  ✅   |   ❌    |    ❌      |   ❌
Cadastros - Usuários        |  ✅   |   ❌    |    ❌      |   ❌
Cadastros - Equipes         |  ✅   |   ❌    |    ❌      |   ❌
Cadastros - Tipos           |  ✅   |   ❌    |    ❌      |   ❌
Cadastros - Permissões      |  ✅   |   ❌    |    ❌      |   ❌
Financeiro                  |  ✅   |   ✅    |    ❌      |   ❌
Integrações                 |  ✅   |   ❌    |    ❌      |   ❌
Configurações               |  ✅   |   ❌    |    ❌      |   ❌
Central Empresa             |  ✅   |   ❌    |    ❌      |   ❌
Auditoria                   |  ✅   |   ✅    |    ❌      |   ❌
Painel Super Admin          |  ❌   |   ❌    |    ❌      |   ❌
```

### Abordagem Técnica

#### 1. Banco de Dados — Nova tabela `user_permissions`

Em vez de hardcodar permissões, a solução usa uma tabela de permissões granulares que o Admin pode customizar por usuário. Isso permite criar um perfil "Supervisor" com acesso a alguns módulos, mas bloquear outros se necessário.

A nova tabela `user_permissions` armazena permissões no formato `{module: string, actions: string[]}` por `profile_id`. O papel (`role`) ainda define o template padrão, mas o Admin pode ajustar individualmente via a nova aba "Permissões".

Adicionamos os novos papéis ao enum existente `tenant_role` no banco: `gerente` e `supervisor`.

#### 2. Hook `usePermissions` — Controle centralizado

Criamos um hook `usePermissions()` que:
- Lê o papel do `tenantUser`
- Retorna booleans como `canManageUsers`, `canViewReports`, `canApproveAgreements`, etc.
- Respeita customizações individuais via `user_permissions`
- Usado em todas as páginas para mostrar/ocultar elementos

#### 3. Aba "Permissões do Usuário" em Cadastros

Nova aba dentro de `CadastrosPage` (visível apenas para Admin) chamada "Permissões". Interface com:
- Lista de usuários do tenant
- Card por usuário mostrando seu papel (template base)
- Checkboxes organizados por módulo para customizar permissões individuais
- Botão "Restaurar Padrão" que volta ao template do papel

#### 4. Ajustes nas páginas existentes

Cada página/componente usa o novo hook para controlar acesso:
- `AppLayout` — menu lateral adaptado por papel
- `AutomacaoPage` — acesso bloqueado para Gerente/Supervisor/Operador
- `ContactCenterPage` — tabs administrativas visíveis para Admin e Supervisor
- `CadastrosPage` — visível apenas para Admin
- `RelatoriosPage` — visível para Admin, Gerente, Supervisor
- `FinanceiroPage` — visível para Admin e Gerente
- `CarteiraPage` — botões de criar/importar por papel
- `AcordosPage` — botão aprovar/rejeitar por papel
- `UsersPage` — select de papel com 4 opções: Operador, Supervisor, Gerente, Admin

### Arquivos a Criar/Modificar

**Banco de Dados (1 migração):**
- Adicionar `gerente` e `supervisor` ao enum `tenant_role`
- Criar tabela `user_permissions` com RLS
- Criar função `get_user_permissions()` SECURITY DEFINER

**Novos Arquivos:**
- `src/hooks/usePermissions.ts` — hook centralizado de permissões
- `src/components/cadastros/UserPermissionsTab.tsx` — aba de gerenciamento de permissões

**Arquivos Modificados:**
- `src/hooks/useTenant.tsx` — expor `userRole` tipado com os 4 papéis
- `src/components/AppLayout.tsx` — menu por papel (Relatórios, Financeiro, Automação só para Admin/Gerente)
- `src/pages/CadastrosPage.tsx` — adicionar aba "Permissões"
- `src/pages/UsersPage.tsx` — select com 4 papéis + convite com 4 opções
- `src/pages/AutomacaoPage.tsx` — bloquear para não-admin
- `src/pages/RelatoriosPage.tsx` — liberar para Gerente/Supervisor
- `src/pages/FinanceiroPage.tsx` — liberar para Gerente
- `src/pages/ContactCenterPage.tsx` — tabs por papel
- `src/pages/AcordosPage.tsx` — aprovar/rejeitar por papel
- `src/pages/CarteiraPage.tsx` — criar/importar por papel
- `src/pages/AuditoriaPage.tsx` — liberar para Gerente

### Ordem de Execução

1. Migração SQL: enum + tabela `user_permissions` + RLS + função RPC
2. Hook `usePermissions` centralizado
3. Atualizar `useTenant` para incluir os novos papéis no tipo
4. Componente `UserPermissionsTab`
5. Adaptar todas as páginas usando o novo hook
6. Ajustar `UsersPage` com os 4 papéis
7. Ajustar `AppLayout` para menu dinâmico por papel
