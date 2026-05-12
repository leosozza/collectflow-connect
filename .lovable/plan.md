## Diagnóstico

A aba **Cadastros → Usuários** (`src/pages/UsersPage.tsx`, linha 461) bloqueia o acesso usando `profile?.role !== "admin"` — isto é, lê o campo `role` da tabela `profiles`.

Conferindo no banco para a Sabrina Leal (Candy Gloss):

```
full_name     | profiles.role | tenant_users.role | tenant
Sabrina Leal  | operador      | admin             | Candy Gloss
```

Ela é admin do tenant em `tenant_users` (a fonte de verdade que o `useTenant` usa via RPC `is_tenant_admin`), mas em `profiles.role` ficou como `operador`. Como a página consulta `profiles.role`, ela vê "Acesso restrito a administradores".

A causa raiz é dessincronização entre `profiles.role` e `tenant_users.role`: na criação/edição de usuários a `role` é gravada nas duas tabelas, mas qualquer alteração feita só em `tenant_users` (ou inconsistência histórica de onboarding) deixa `profiles.role` para trás. Esse problema vai se repetir em qualquer novo tenant onde o admin não for criado/editado pelo fluxo padrão.

## Plano de correção

### 1. Frontend: usar a fonte de verdade correta
Em `src/pages/UsersPage.tsx`:
- Substituir o guard `profile?.role !== "admin"` (linha 461) por `!isTenantAdmin` vindo de `useTenant()` — esse hook já considera `is_super_admin` e `is_tenant_admin` (RPCs SECURITY DEFINER baseadas em `tenant_users`).
- Trocar também o `enabled: profile?.role === "admin"` da query (linha 198) por `enabled: isTenantAdmin`.

Sem outras alterações de UI/lógica no arquivo.

### 2. Backend: sincronização automática `tenant_users.role` → `profiles.role`
Migration nova:

- **Backfill imediato**: `UPDATE public.profiles p SET role = tu.role FROM public.tenant_users tu WHERE tu.user_id = p.user_id AND p.role IS DISTINCT FROM tu.role;` (apenas para roles válidas em `profiles`, isto é, `admin`/`operador`; `gerente`/`supervisor` mapeiam para `operador` no schema atual de `profiles.role`).
- **Trigger** `sync_profile_role_from_tenant_users` em `tenant_users` (AFTER INSERT OR UPDATE OF role): atualiza `profiles.role` do `user_id` correspondente. Para roles que não existem em `profiles` (gerente/supervisor), grava `operador`; `admin` grava `admin`. Não toca em super_admin (esse fluxo já é gerido por outro caminho).
- Função `SECURITY DEFINER` com `set search_path = public` para respeitar RLS.

Isso garante que qualquer novo tenant criado e qualquer mudança de papel feita pelo painel (super admin ou admin do tenant) mantenha as duas tabelas alinhadas, eliminando a regressão para os próximos tenants.

### 3. Verificação
Após a migration:
- Conferir via `SELECT` que Sabrina Leal aparece com `profiles.role = 'admin'`.
- Logar com a Sabrina (ou simular) e abrir Cadastros → Usuários: deve carregar a listagem normalmente.

## Fora de escopo
- Não mexer em `ThreeCPlusPanel`, `WhatsAppChatLayout`, `ChatPanel` agora — são checagens diferentes (operador vs admin para UI de telefonia/chat) e não causam o bug relatado. Podem ser revistas em tarefa separada se desejado.
- Não alterar `AdminUsuariosPage` (Super Admin) — não é a tela do screenshot.
- Sem alterações no fluxo de criação de usuário (`invokeCreateUser`) — o trigger cobre o caso.