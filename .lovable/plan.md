
## Análise Completa e Plano de Correção

### Problemas Identificados

**1. Menu lateral com itens inesperados (Auditoria, Automação, Financeiro, Relatórios)**

A causa raiz está em `src/hooks/useTenant.tsx`, linha 105:

```ts
const userRole = isSA ? "super_admin" : isTA ? "admin" : "operador";
```

O hook usa apenas duas RPCs (`is_super_admin` e `is_tenant_admin`) e nunca consulta o papel real do usuário na tabela `tenant_users`. Quando o usuário é Admin, ele recebe `"admin"` — e com as permissões padrão do Admin no `usePermissions`, todos os itens de menu (Auditoria, Financeiro, Automação, Relatórios) aparecem. Isso é **tecnicamente correto** segundo o plano aprovado, mas o usuário confirma que não esperava esses itens antes da implementação.

A correção é: chamar `get_my_tenant_role()` para ler o papel real armazenado em `tenant_users` (que pode ser `gerente`, `supervisor`, etc.), mas manter a lógica de segurança via RPCs de admin.

**2. Apenas 2 perfis no dropdown "Tipo de Usuário"**

Em `src/pages/UsersPage.tsx`, linhas 352-355, o Select só tem `operador` e `admin`. Precisam ser adicionados `gerente` e `supervisor`.

Também: o `updateMutation` envia `role: editRole as "admin" | "operador"` — o tipo precisa ser expandido para incluir os novos papéis.

**3. Grade de Comissão em /Cadastros**

A tabela `commission_grades` já existe no banco (2 registros confirmados). Falta criar:
- O componente `CommissionGradesTab` para CRUD de grades (criar, editar tiers, excluir)
- Adicionar a entrada no menu lateral de `CadastrosPage` abaixo de "Permissões"

**4. Botão "Novo Usuário" em Usuários**

Atualmente só existe "Convidar por Link". Precisamos de um botão "Novo Usuário" que abre um dialog com campos: Nome, Email, Senha temporária, Cargo — e cria o usuário via Supabase Admin (edge function) ou via convite direto.

---

### Solução Técnica

#### Fix 1 — `useTenant.tsx`: ler o papel real via `get_my_tenant_role()`

Substituir a lógica de `userRole` para chamar também `get_my_tenant_role()`:

```ts
const [{ data: isSA }, { data: isTA }, { data: realRole }] = await Promise.all([
  supabase.rpc("is_super_admin", { _user_id: user.id }),
  supabase.rpc("is_tenant_admin", { _user_id: user.id, _tenant_id: tenantId }),
  supabase.rpc("get_my_tenant_role"),
]);

const userRole = isSA 
  ? "super_admin" 
  : isTA 
    ? "admin" 
    : (realRole as TenantRole) || "operador";
```

Isso garante que Gerentes e Supervisores recebam seus papéis reais, e `usePermissions` calcule as permissões corretamente para eles. O Admin continua vendo Auditoria, Financeiro, etc., pois são suas permissões corretas.

#### Fix 2 — `UsersPage.tsx`: adicionar todos os 4 papéis

Atualizar o Select de edição e o de convite para incluir todos os papéis:
- Operador, Supervisor, Gerente, Admin
- Expandir o tipo do `updateMutation` de `"admin" | "operador"` para todos os papéis válidos

#### Fix 3 — `CommissionGradesTab`: novo componente em Cadastros

Criar `src/components/cadastros/CommissionGradesTab.tsx` com:
- Lista de grades existentes em cards
- Cada card mostra: nome da grade, tipo (Fixa ou Escalonada), tabela de tiers
- Botão "Nova Grade" abre um dialog com:
  - Nome da grade
  - Tipo: Fixa (1 tier com % direto) ou Escalonada (múltiplos tiers com faixas de valor)
  - Para Escalonada: adicionar/remover faixas com campos Min, Max, % Comissão
- Botão de excluir por grade
- Usar a tabela `commission_grades` já existente (campo `tiers` é jsonb)

Adicionar em `CadastrosPage.tsx`:
- Novo grupo "Comissionamento" (ou adicionar em "Acesso") com item "Grade de Comissão"
- Ícone: `TrendingUp` ou `Percent`
- Renderizar `<CommissionGradesTab />` quando ativo

#### Fix 4 — Botão "Novo Usuário" em `UsersPage.tsx`

Adicionar botão ao lado de "Convidar por Link". Ao clicar, abre um Dialog com:
- Nome completo
- Email
- Cargo (operador/supervisor/gerente/admin)
- Opção: Enviar convite por email (gera invite link igual ao existente mas envia o link diretamente para o email digitado, usando a funcionalidade de invite já implementada)

Como a criação direta de usuário via Supabase Admin API requer uma edge function, a abordagem mais simples e segura é reutilizar o sistema de convite existente: o "Novo Usuário" gera um link de convite e exibe para copiar/compartilhar — diferente do "Convidar por Link" que requer o Admin gerar manualmente. O novo botão terá um formulário mais completo (com nome e email preenchidos).

---

### Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useTenant.tsx` | Chamar `get_my_tenant_role()` para obter papel real |
| `src/pages/UsersPage.tsx` | Adicionar 4 papéis no select + botão "Novo Usuário" |
| `src/pages/CadastrosPage.tsx` | Adicionar entrada "Grade de Comissão" no menu |
| `src/components/cadastros/CommissionGradesTab.tsx` | Novo componente (criar) |

Nenhuma migração de banco necessária — a tabela `commission_grades` já existe com RLS correto.
