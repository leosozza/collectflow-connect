

## Plano: Sistema de Atribuição de Clientes na Carteira

### Resumo
Criar um sistema de atribuição de operadores a clientes, com dois modos de operação configuráveis pelo admin: **"Mar Aberto"** (todos veem tudo) e **"Atribuição"** (operador vê apenas clientes atribuídos). Dados sensíveis (CPF, telefone, email) ficam ocultos para perfis sem permissão.

### Alterações

#### 1. Banco de Dados — Migração
- Adicionar coluna `carteira_mode` na tabela `tenants` (ou usar o campo `settings` JSONB existente) para armazenar o modo: `"open"` (mar aberto, padrão) ou `"assigned"` (atribuição)
- A coluna `operator_id` já existe na tabela `clients` — será usada para vincular clientes a operadores

#### 2. Permissões — `usePermissions.ts`
- Adicionar ação `"view_full_data"` ao módulo `carteira` para controlar quem vê CPF/telefone/email completos
- Admin e super_admin têm `view_full_data` por padrão
- Operador só vê dados completos de clientes atribuídos a ele (quando em modo "Atribuição")

#### 3. Configuração do Tenant — `TenantSettingsPage.tsx` ou `CadastrosPage.tsx`
- Adicionar toggle no painel do admin para alternar entre modo "Mar Aberto" e "Atribuição"
- Salvar no campo `settings` do tenant: `{ carteira_mode: "open" | "assigned" }`

#### 4. Página Carteira — `CarteiraPage.tsx`
- **Botão "Atribuir"**: Ao lado de WhatsApp e Discador na barra superior quando há seleção. Abre dialog para escolher operador
- **Ocultação de dados**: Quando o usuário não tem permissão `view_full_data` no módulo `carteira` E o cliente não está atribuído a ele:
  - CPF: `***.***.789-00` (mostra apenas últimos 5 caracteres)
  - Telefone: `(**) ****-1234` 
  - Email: `j***@email.com`
- **Filtro por atribuição** (modo "Atribuição"): Operadores sem `view` completo veem apenas clientes com `operator_id` = seu profile_id
- **Dialog de Atribuição**: Lista de operadores do tenant, permite selecionar e atribuir em lote via `UPDATE clients SET operator_id = X WHERE id IN (...)`

#### 5. Novo Componente — `AssignOperatorDialog.tsx`
- Dialog com lista de operadores (busca `profiles` do tenant)
- Botão confirmar que faz o update em lote
- Mostra quantidade de clientes selecionados

#### 6. Hook `useTenant` / settings
- Expor `carteiraMode` do tenant settings para uso nos componentes

### Lógica de visibilidade

```text
Se modo = "open" (Mar Aberto):
  → Todos os perfis com permissão carteira.view veem todos os clientes
  → Dados sensíveis: visíveis se tem carteira.view_full_data OU é admin
  
Se modo = "assigned" (Atribuição):
  → Admin/gerente: vê todos os clientes
  → Operador: vê apenas clientes com operator_id = seu profile_id
  → Dados sensíveis do cliente atribuído: sempre visíveis para o operador atribuído
  → Dados de clientes não atribuídos (se visíveis): ocultados
```

### Arquivos alterados/criados
- **Migração SQL**: Adicionar `carteira_mode` ou usar `settings` JSONB do tenant
- `src/hooks/usePermissions.ts` — nova ação `view_full_data`
- `src/pages/CarteiraPage.tsx` — botão Atribuir, lógica de ocultação, filtro por operador
- `src/components/carteira/AssignOperatorDialog.tsx` — novo componente
- `src/pages/CadastrosPage.tsx` ou `TenantSettingsPage.tsx` — toggle de modo
- `src/lib/formatters.ts` — funções de mascaramento (maskCPF, maskPhone, maskEmail)

