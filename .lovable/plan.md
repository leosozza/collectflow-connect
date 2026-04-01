

# Plano: Corrigir create-user, exclusão completa e limpeza de usuários

## Causa raiz

A Edge Function `create-user` **não sobe** (BootFailure) porque a linha 189 declara `const newUserId = authData.user.id;` quando `newUserId` já foi declarado como `let` na linha 137. Isso é um erro de sintaxe que impede qualquer execução da function.

Secundariamente, a exclusão de usuários em `UsersPage.tsx` (linha 330) apaga apenas `profiles`, deixando `tenant_users` e `auth.users` intactos — gerando usuários órfãos que causam conflitos em recadastros.

## Etapas

### 1. Corrigir `create-user/index.ts`
- **Remover linha 189** (`const newUserId = authData.user.id;`) — é redundante, pois o `else` na linha 186 já atribui `newUserId = authData.user.id`
- Manter o fallback de reaproveitamento por email existente (linhas 145-187)
- No rollback (linhas 198, 225): adicionar flag `wasCreatedHere` para só deletar auth user se ele foi criado nesta execução (não reutilizado)
- Atualizar CORS headers para incluir headers extras do supabase-js (`x-supabase-client-platform`, etc.)

### 2. Adicionar action `delete_user` na mesma edge function
- Nova action que recebe `user_id` e executa remoção completa:
  - `operator_instances` (por profile_id)
  - `user_permissions` (por profile_id)
  - `invite_links` (por created_by ou used_by)
  - `profiles`
  - `tenant_users`
  - `auth.users` (via `supabaseAdmin.auth.admin.deleteUser`)
- Validação: só permite deletar usuários do mesmo tenant do caller

### 3. Atualizar exclusão em `UsersPage.tsx`
- `deleteMutation` passa a chamar `supabase.functions.invoke("create-user", { body: { action: "delete_user", user_id } })` em vez de apagar só `profiles`

### 4. Backup e limpeza
- Gerar listagem completa dos usuários atuais (email, user_id, tenant) antes da remoção
- Executar migration para limpar `profiles`, `tenant_users` e dependências dos usuários que NÃO são:
  - `raulsjunior579@gmail.com`
  - `raul@temisconsultoria.com.br`
- Executar remoção dos auth users órfãos via a edge function corrigida (ou via action `delete_user`)

### 5. Validação
- Confirmar que restam apenas os 2 usuários
- Testar criação manual do Vitor (auth + tenant_users + profile)

## Escopo explicitamente fora
- Fluxo de convite/email — não será alterado
- Testes de convite — adiados

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/create-user/index.ts` | Remover redeclaração, adicionar action `delete_user`, flag de rollback, CORS |
| `src/pages/UsersPage.tsx` | `deleteMutation` chama edge function com action `delete_user` |
| Migration SQL | Limpeza de usuários não autorizados |

## Detalhes técnicos

```text
Linha 189 atual (causa o BootFailure):
  const newUserId = authData.user.id;   ← REMOVER

Já existe na linha 186:
  newUserId = authData.user.id;         ← correto (usa o let da linha 137)
```

Rollback seguro:
```typescript
let wasCreatedHere = false;
// após createUser sucesso:
wasCreatedHere = true;
// no catch/rollback:
if (wasCreatedHere) await supabaseAdmin.auth.admin.deleteUser(newUserId);
```

## Entregáveis finais
- Causa raiz documentada
- Lista de arquivos alterados
- Lista de usuários removidos vs preservados
- Resultado do teste de criação do Vitor

