

# Plano: Corrigir Criação do Usuário Vitor (Email Duplicado)

## Problema Raiz

O usuário `vitordin07@outlook.com` já existe na tabela `auth.users` (id: `ddfcb452-c709-4ccd-a004-12bb384e7b2b`) — sobrou da tentativa anterior. A migration de limpeza removeu `profiles` e `tenant_users`, mas **não removeu o registro de auth**. Quando a edge function tenta `createUser` com o mesmo email, recebe erro de duplicidade.

## Solução

Duas correções:

### 1. Limpar o auth user órfão (Migration)
- Usar `supabase.auth.admin.deleteUser` não é possível via SQL
- Criar migration que limpa quaisquer restos em `profiles`/`tenant_users` (já limpos)
- A remoção do auth user será feita via edge function (chamada admin)

**Na prática**: Invocar a edge function `create-user` com uma nova action `delete_user` para deletar o auth user órfão, OU simplesmente melhorar a edge function para detectar email existente e reutilizar o auth user.

### 2. Tornar a edge function resiliente a emails existentes (`create-user/index.ts`)
- Se `createUser` falhar com erro de email duplicado:
  - Buscar o auth user existente por email via `listUsers`
  - Verificar que o user **não** pertence a outro tenant
  - Reutilizar o `user.id` existente e prosseguir com insert em `tenant_users` + upsert em `profiles`
- Isso resolve o problema atual E previne reincidências futuras

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/create-user/index.ts` | Adicionar fallback: se email já existe em auth, reutilizar o user existente em vez de falhar |

## Detalhes técnicos

```typescript
// Após createUser falhar com "already registered":
const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
const existing = existingUsers.users.find(u => u.email === email);
if (existing) {
  // Verificar que não pertence a outro tenant
  // Reutilizar existing.id como newUserId
}
```

## O que NÃO muda
- Fluxo de update_password — intacto
- Lógica de rollback — intacta
- RLS e permissões — intactas
- Layout — intacto

