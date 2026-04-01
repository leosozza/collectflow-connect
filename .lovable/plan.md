
# Plano: Corrigir Edge Function `create-user`

## Problema

A função `create-user` usa `supabaseClient.auth.getClaims(token)` (linha 30), mas esse método pode não existir na versão do `@supabase/supabase-js@2` resolvida pelo `esm.sh`. O erro silencioso resulta em status 500.

## Correção

### `supabase/functions/create-user/index.ts`

Substituir `getClaims` por `getUser(token)` que é estável e disponível em todas as versões do supabase-js v2:

```typescript
// ANTES (linha 29-36):
const token = authHeader.replace("Bearer ", "");
const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
if (claimsError || !claimsData?.claims) { ... }
const callerId = claimsData.claims.sub;

// DEPOIS:
const { data: { user: callerUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(
  (await supabaseClient.auth.getUser()).data.user?.id ?? ""
);
```

Na prática, a abordagem mais simples e confiável:
1. Usar `supabaseClient.auth.getUser()` (com o token do caller no header) para obter o `user.id`
2. Usar esse ID para buscar `tenant_users`

Isso elimina a dependência do `getClaims` e funciona em qualquer versão.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/create-user/index.ts` | Substituir `getClaims` por `getUser()` |

## O que NÃO muda
- Lógica de criação de usuário — intacta
- Verificação de admin — intacta
- Rollback em caso de erro — intacto
