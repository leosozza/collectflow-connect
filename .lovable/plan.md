## Reformulação Completa: Criação de Usuário Direto + Permissões por Perfil

### Contexto e Análise

**O que existe hoje:**

- "Novo Usuário" apenas gera um link de convite — o usuário precisa acessar o link e preencher seus próprios dados.
- "Permissões" mostra todos os usuários e permite customizar cada um individualmente.
- "Tipo de Usuário" tem 4 papéis base (Operador, Supervisor, Gerente, Admin).

**O que o usuário quer:**

1. Admin cria usuário completo diretamente (nome, email, senha, cargo) — usuário não precisa fazer nada. 
2. Permissões gerenciadas **por perfil** (ex: "Operador Padrão", "Supervisor Comercial", etc.) — não por usuário individual.
3. Capacidade de criar **perfis customizados** além dos 4 padrões.
4. Ao cadastrar/editar usuário, escolher qual **Perfil** ele pertence.

---

### Parte 1 — Criação Direta de Usuário (Edge Function)

A criação de usuário sem envio de link requer o uso da API Admin do Supabase (`supabase.auth.admin.createUser`), que só pode ser chamada server-side com a chave de serviço. Será criada uma nova Edge Function `create-user`.

**Fluxo:**

1. Admin preenche: Nome, Email, Senha, Cargo, Perfil de Permissão.
2. O frontend chama a Edge Function `create-user`.
3. A Edge Function cria o usuário em `auth.users` com `email_confirm: true` (já confirmado, sem email de verificação).
4. A Edge Function insere em `tenant_users` com o cargo selecionado.
5. A Edge Function atualiza `profiles` com `tenant_id` e `full_name`.
6. O usuário fica ativo imediatamente e pode fazer login.

**Edge Function `supabase/functions/create-user/index.ts`:**

```typescript
// Recebe: { full_name, email, password, role, tenant_id }
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name },
});
// Depois insere em tenant_users e profiles
```

---

### Parte 2 — Nova Estrutura: Perfis de Permissão

**Novo conceito:** Em vez de gerenciar permissões por usuário, o admin cria "Perfis de Permissão" reutilizáveis. Cada usuário é vinculado a um perfil.

**Nova tabela no banco: `permission_profiles**`

```sql
CREATE TABLE permission_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,               -- Ex: "Operador Padrão", "Supervisor Comercial"
  base_role tenant_role NOT NULL,   -- papel base (operador, supervisor, gerente, admin)
  permissions jsonb NOT NULL DEFAULT '{}', -- { module: actions[] }
  is_default boolean NOT NULL DEFAULT false, -- perfis padrão do sistema
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**RLS:**

- SELECT: qualquer usuário do tenant pode ver
- INSERT/UPDATE/DELETE: apenas admins do tenant

**Vincular usuário a perfil:**
Nova coluna `permission_profile_id uuid` na tabela `profiles`, referenciando `permission_profiles(id)`.

**Lógica de permissões (atualizada em `usePermissions.ts`):**

```
1. Pega o papel base do tenant_users (operador, supervisor, gerente, admin)
2. Se o usuário tem um permission_profile vinculado → usa as permissões do perfil
3. Caso contrário → usa os defaults do papel base (ROLE_DEFAULTS)
```

---

### Parte 3 — Nova UI: Aba "Permissões" em Cadastros

**Substituição completa do `UserPermissionsTab`:**

A nova interface terá duas seções:

**3.1 — Gerenciador de Perfis de Permissão**

- Cards para os 4 perfis padrão (Operador, Supervisor, Gerente, Admin) — não deletáveis
- Botão "+ Novo Perfil" para criar perfis customizados
- Ao clicar em um perfil, abre um painel lateral com checkboxes por módulo (igual ao layout atual)
- Perfis customizados podem ser deletados se não houver usuários vinculados
- Botão "Salvar" por perfil

**3.2 — Usuários vinculados ao perfil**

- Cada card de perfil mostra quantos usuários estão vinculados (badge)
- Ao expandir, lista os usuários com opção de desvincular / trocar de perfil

---

### Parte 4 — Atualização do Formulário de Usuário

No dialog de "Novo Usuário" e "Editar Usuário" em `UsersPage.tsx`:

**Campos de "Novo Usuário" (criação direta):**

- Nome Completo
- Email
- Senha temporária (o admin define)
- Cargo (papel base): Operador / Supervisor / Gerente / Admin
- Perfil de Permissão (select com os perfis criados em Permissões)
- Grade de Comissão
- Agente 3CPlus
- Instâncias WhatsApp

**Campos de "Editar Usuário":**

- Mesmos campos, sem campo de senha
- Campo "Perfil de Permissão" adicionado

---

### Arquivos a Criar/Modificar


| Arquivo                                                | Tipo          | Mudança                                            |
| ------------------------------------------------------ | ------------- | -------------------------------------------------- |
| `supabase/migrations/YYYYMMDD_permission_profiles.sql` | SQL           | Criar tabela + coluna + RLS + dados iniciais       |
| `supabase/functions/create-user/index.ts`              | Edge Function | Criar usuário diretamente via Admin API            |
| `src/components/cadastros/UserPermissionsTab.tsx`      | Modificar     | Reformular para gerenciar perfis                   |
| `src/pages/UsersPage.tsx`                              | Modificar     | "Novo Usuário" com campos completos + campo Perfil |
| `src/hooks/usePermissions.ts`                          | Modificar     | Ler permissões do perfil vinculado                 |


---

### Ordem de Execução

1. **Migração SQL**: criar `permission_profiles`, adicionar `permission_profile_id` em `profiles`, RLS, dados iniciais (4 perfis padrão por tenant)
2. **Edge Function `create-user**`: recebe dados do admin, cria usuário autenticado, associa ao tenant
3. `**usePermissions.ts**`: adicionar leitura do perfil vinculado via nova RPC ou query
4. `**UserPermissionsTab.tsx**`: reformular para CRUD de perfis de permissão
5. `**UsersPage.tsx**`: atualizar "Novo Usuário" (formulário completo) e "Editar Usuário" (campo Perfil)

---

### Dados Iniciais (Perfis Padrão)

Quando um tenant é criado, 4 perfis padrão serão automaticamente disponibilizados. Para tenants existentes, a migração insere os perfis iniciais via trigger ou seção de dados.

Os 4 perfis padrão terão `is_default = true` e usarão os mesmos defaults que o `ROLE_DEFAULTS` atual. O admin pode editar as permissões desses perfis padrão mas não deletá-los.

---

### Impacto na Segurança

- A Edge Function `create-user` valida que o usuário chamador é admin do tenant antes de criar qualquer usuário
- A senha criada pelo admin é temporária — o usuário pode trocá-la pelo perfil
- `email_confirm: true` evita email de confirmação desnecessário
- Roles continuam armazenadas em `tenant_users`, nunca em `profiles` (conforme diretriz de segurança)