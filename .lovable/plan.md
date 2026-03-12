

# Unificar gestão de planos no Catálogo de Serviços do Super Admin

## Resumo

Adicionar uma terceira aba "Planos" na página `AdminServicosPage` para gerenciar os planos de tenants (Starter, Professional, Enterprise). Atualizar os valores e limites dos planos existentes no banco. Ajustar o fluxo de criação de novo cliente no SuperAdminPage para selecionar o plano e, no caso Enterprise, configurar número de operadores.

## Alterações

### 1. Atualizar dados dos planos no banco (UPDATE via insert tool)

- **Starter**: `price_monthly = 499.99`, `limits = { max_users: 6, max_clients: 500, features: [...] }` (5 operadores + 1 admin = 6 users)
- **Professional**: `price_monthly = 999.99`, `limits = { max_users: 11, max_clients: 5000, features: [...] }` (10 operadores + 1 admin = 11 users)
- **Enterprise**: `price_monthly = 0` (personalizado), `limits = { max_users: 999, max_clients: 999999, custom: true, features: [...] }`

### 2. `src/pages/admin/AdminServicosPage.tsx` — Adicionar aba "Planos"

- Adicionar terceira aba com ícone `CreditCard` chamada "Planos"
- Listar planos da tabela `plans` com colunas: Nome, Slug, Preço, Max Usuários, Max Clientes, Ativo
- Dialog de edição para alterar preço, limites e status
- Para Enterprise, mostrar indicação "Personalizado" no lugar do preço

### 3. `src/pages/SuperAdminPage.tsx` — Melhorar criação de novo cliente

- No formulário "Novo Cliente", adicionar select para escolher o plano (Starter/Professional/Enterprise)
- Para Enterprise, exibir campo adicional para definir número de operadores (salvo em `tenants.settings`)
- No Sheet de gerenciamento, mostrar e permitir alterar o plano do tenant
- Remover o hardcoded `SERVICE_CATALOG` (já existe na tabela `service_catalog`)

### 4. `src/pages/OnboardingPage.tsx` — Atualizar exibição

- Ajustar card do Enterprise para mostrar "Sob consulta" em vez de R$ 0,00
- Manter os outros planos com os novos valores

## Arquivos a alterar

| Arquivo | Ação |
|---------|------|
| SQL (insert tool) | UPDATE planos com novos preços e limites |
| `src/pages/admin/AdminServicosPage.tsx` | Adicionar aba "Planos" com CRUD |
| `src/pages/SuperAdminPage.tsx` | Seletor de plano na criação + gerenciamento |
| `src/pages/OnboardingPage.tsx` | Ajustar exibição Enterprise "Sob consulta" |

