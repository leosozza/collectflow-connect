

# Plano: Correção Definitiva do Fluxo de Criação/Exclusão de Usuários

## Causa Raiz Atual do 401

Os logs confirmam: o POST mais recente para `create-user` retornou **401** porque a sessão do caller (`session_id c1332745`) foi invalidada durante a limpeza em massa de usuários. O `getUser()` na linha 29 falha com `session_not_found`. Após re-login (19:17:12), a function retornou **500** (bug do `newUserId` duplicado, já corrigido). A tentativa seguinte (19:18:30) deu 401 novamente porque a sessão do novo login também foi perdida. **A function funciona, o token do caller é que está inválido.** Após re-login, a criação deve funcionar -- mas o código tem vários problemas estruturais que precisam ser corrigidos.

## Etapas

### 1. Reescrever `create-user/index.ts` com instrumentação e idempotência

**Logging estruturado** em cada etapa (caller auth, tenant resolution, auth create/reuse, tenant_users upsert, profiles upsert, rollback).

**Erros estruturados** com `{ code, message, details }` em todas as respostas de erro.

**Idempotência completa:**
- Email normalizado com `trim().toLowerCase()` antes de qualquer operação
- Usuário novo → criar normalmente
- Existe no auth sem tenant → reaproveitar, vincular
- Existe no auth no mesmo tenant → atualizar senha/metadados, retornar sucesso
- Existe no auth em outro tenant → bloquear com `TENANT_CONFLICT` / 409
- Auth órfão → corrigir automaticamente

**Tenant ID correto:**
- Admin comum → usa `callerTenantUser.tenant_id`
- Super admin + `body.tenant_id` preenchido → usa `body.tenant_id`

**Role no profile:** usar o `role` do body, não hardcodar `"operador"` (linha 264 atual).

**Rollback seguro:** flag `wasCreatedHere` já existe; garantir que nunca deleta auth user reaproveitado.

**Busca por email:** substituir `listUsers({ perPage: 1000 })` por busca usando `getUserByEmail` ou filtro direto mais confiável.

### 2. Corrigir action `delete_user` na mesma function

Revisar cascading delete para cobrir todas as dependências:
- `operator_instances` (by profile_id)
- `user_permissions` (by profile_id)
- `invite_links` (by created_by ou used_by)
- `profiles` (by user_id)
- `tenant_users` (by user_id)
- `auth.users` (via admin.deleteUser)

Validar que o target pertence ao tenant do caller (já existe, manter).

### 3. Atualizar frontend `UsersPage.tsx`

**Error handling real:**
- Parsear `data.code`, `data.message`, `data.details` da resposta
- Mensagens específicas por código:
  - `SESSION_EXPIRED` → "Sessão expirada. Faça logout e login."
  - `TENANT_CONFLICT` → "Usuário já pertence a outra empresa."
  - `USER_REUSED` → toast de sucesso informando reaproveitamento
  - `VALIDATION_ERROR` → mostrar `details`
- Nunca exibir apenas "non-2xx" genérico

Aplicar o mesmo padrão no `deleteMutation` e `handleChangePassword`.

### 4. Atualizar `AdminUsuariosPage.tsx`

Mesmo tratamento de erro estruturado. Garantir que `body.tenant_id` é enviado quando super_admin seleciona um tenant.

### 5. Validar integridade de dados

Verificar via query se existe unicidade em `profiles.user_id` e `tenant_users(user_id)`. Se constraints estiverem faltando, documentar (não criar migration agora se já existem via unique index).

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/create-user/index.ts` | Reescrita: logging, erros estruturados, idempotência, tenant_id por role, role no profile, delete cascading |
| `src/pages/UsersPage.tsx` | Error handling com códigos estruturados |
| `src/pages/admin/AdminUsuariosPage.tsx` | Error handling com códigos estruturados |

## Escopo fora
- Fluxo de convite/email
- Migrations de schema (constraints já existentes serão verificadas, não alteradas)

## Detalhes Tcnicos

Estrutura de resposta de erro:
```typescript
{ code: "SESSION_EXPIRED" | "TENANT_CONFLICT" | "VALIDATION_ERROR" | "AUTH_CREATE_FAILED" | ...,
  message: "Descrição legível",
  details: "Contexto adicional" }
```

Logging na function:
```typescript
console.log(JSON.stringify({ step: "auth_caller", callerId, email: callerUser.email }));
console.log(JSON.stringify({ step: "tenant_resolved", tenantId, callerRole }));
console.log(JSON.stringify({ step: "auth_create", status: "reused"|"created", newUserId }));
```

