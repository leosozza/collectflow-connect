
## Diagnóstico e Correções

### Bug 1: Perfil criado não aparece para o Admin

**Causa identificada:** O usuário `madusousa070@gmail.com` tem cargo `operador` na tabela `tenant_users`. A RLS da tabela `permission_profiles` para INSERT/UPDATE/DELETE exige `is_tenant_admin(auth.uid(), tenant_id)`. Um operador **não pode criar perfis** — a tentativa é bloqueada silenciosamente pelo banco.

Porém, o problema relatado é diferente: o Admin diz que um novo perfil **não aparece** para ele. Verificando o banco, só existem os **4 perfis padrão** (`created_at: 2026-02-20 19:01:48`). Nenhum perfil adicional foi criado com sucesso.

A causa real é que o botão "Novo Perfil" no `UserPermissionsTab.tsx` chama diretamente `supabase.from("permission_profiles").insert(...)` sem tratamento de erro adequado para mostrar a mensagem de falha ao usuário. Quando um operador tenta criar, o banco rejeita mas a UI mostra "Perfil criado!" sem verificar corretamente, ou falha silenciosamente.

**Adicionalmente:** O Admin precisaria estar logado com o perfil correto (role `admin` em `tenant_users`). A consulta mostra que o Admin `Raul Seixas` (`0e5a460b`) tem role `admin` no tenant — portanto a criação pelo Admin deveria funcionar. O problema pode ser um **erro de cache ou query** no `onError` não exibindo o toast.

**Correção:** Melhorar o tratamento de erro no `createMutation` para exibir a mensagem real do Supabase, e garantir que o `queryClient.invalidateQueries` seja acionado corretamente após criação.

### Bug 2: Campos CPF e Telefone não existem na tabela `profiles`

**Confirmado pelo banco:** A tabela `profiles` não tem colunas `cpf` ou `phone`. Precisamos adicioná-las via migração SQL antes de usá-las no formulário e na edge function.

Campos existentes em `profiles`: `id`, `user_id`, `full_name`, `role`, `commission_rate`, `created_at`, `updated_at`, `commission_grade_id`, `tenant_id`, `threecplus_agent_id`, `avatar_url`, `birthday`, `bio`, `permission_profile_id`.

---

### Solução Completa

#### Parte 1 — Migração SQL: adicionar CPF e Telefone à tabela `profiles`

```sql
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS phone text;
```

#### Parte 2 — Atualizar Edge Function `create-user`

Adicionar suporte aos campos `cpf` e `phone` no body da requisição e no `profileUpdate`.

```typescript
// Adicionar ao destructuring do body
const { full_name, email, password, role, cpf, phone, ... } = body;

// Adicionar ao profileUpdate
if (cpf) profileUpdate.cpf = cpf;
if (phone) profileUpdate.phone = phone;
```

A edge function já usa `email_confirm: true` — confirmação por email já está desabilitada.

#### Parte 3 — Atualizar formulário "Novo Usuário" em `UsersPage.tsx`

Adicionar campos obrigatórios na ordem solicitada:

```
1. Nome Completo (já existe)
2. CPF (novo — com máscara 000.000.000-00)
3. Telefone (novo — com máscara (00) 00000-0000)
4. E-mail (já existe)
5. Senha (já existe)
6. Cargo (já existe)
7. Grade de Comissão (já existe)
8. Perfil de Permissão (já existe)
9. Agente Discador (já existe como "Agente 3CPlus")
10. Instância WhatsApp (já existe)
```

Adicionar state para `newCpf` e `newPhone`, passar ao `handleCreateUser`, que os envia na chamada da edge function.

#### Parte 4 — Corrigir visibilidade de perfis no `UserPermissionsTab.tsx`

O bug de "perfil criado não aparece" tem como causa mais provável o `onError` genérico que não exibe a mensagem real. Melhorar para:

```typescript
onError: (err: any) => toast.error(err.message || "Erro ao criar perfil"),
```

E garantir que o `invalidateQueries` é chamado com a query key correta após sucesso.

---

### Arquivos a Modificar/Criar

| Arquivo | Tipo | Mudança |
|---|---|---|
| Nova migração SQL | SQL | Adicionar colunas `cpf` e `phone` à tabela `profiles` |
| `supabase/functions/create-user/index.ts` | Edge Function | Aceitar e salvar `cpf` e `phone` |
| `src/pages/UsersPage.tsx` | Modificar | Adicionar campos CPF e Telefone no formulário "Novo Usuário" |
| `src/components/cadastros/UserPermissionsTab.tsx` | Modificar | Melhorar tratamento de erro no `createMutation` |

### Ordem dos campos no formulário (final)

Nome → CPF → Telefone → E-mail → Senha → Cargo → Grade de Comissão → Perfil do Usuário → Agente Discador → Instância WhatsApp
