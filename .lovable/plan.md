

# Diagnóstico: Por que Barbara não vê o mesmo que Raul

## O que encontrei no banco

| Usuário | `tenant_users.role` | `profiles.role` | `permission_profile_id` |
|---------|---------------------|-----------------|------------------------|
| Raul Jose Seixas Junior | **super_admin** | admin | NULL |
| Raul Seixas | **admin** | admin | NULL |
| Barbara Sampaio | **operador** | operador | "Admin Padrão" |

Barbara tem o perfil de permissões "Admin Padrão" vinculado, mas o campo `role` tanto em `tenant_users` quanto em `profiles` continua **operador**. Isso aconteceu porque:

1. A política SELECT de `tenant_users` só permite ver o próprio registro ou ser super_admin:
   ```
   user_id = auth.uid() OR is_super_admin(auth.uid())
   ```
2. Quando alguém tentou salvar Barbara como "admin", o UPDATE silenciosamente não afetou nenhuma linha — o admin que editou não consegue "ver" a linha da Barbara via SELECT, e o PostgREST exige visibilidade para UPDATE funcionar.

O sistema inteiro verifica `is_tenant_admin()` que olha `tenant_users.role IN ('admin', 'super_admin')`. Como Barbara é "operador" nessa tabela, ela não tem acesso de admin a nada.

## Solução

### 1. Corrigir a RLS de `tenant_users` (SELECT)
Permitir que admins do tenant vejam todos os membros do mesmo tenant:

```sql
DROP POLICY "Users can view own tenant memberships" ON tenant_users;
CREATE POLICY "Users can view tenant memberships" ON tenant_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_tenant_admin(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );
```

### 2. Corrigir os dados da Barbara agora
Atualizar `tenant_users.role` para `'admin'` e `profiles.role` para `'admin'` via migração de dados.

### 3. Sincronizar role ao salvar usuário
No `UsersPage.tsx`, garantir que ao mudar o role de um usuário, o `tenant_users.role` também seja atualizado (e não apenas o `profiles.role` e o `permission_profile_id`). Adicionar verificação de linhas afetadas para não falhar silenciosamente.

### Arquivos
- Migration SQL: corrigir RLS + dados da Barbara
- `src/pages/UsersPage.tsx`: garantir que update de role atualize `tenant_users` também e verifique resultado

### Resultado
- Admins do tenant poderão ver e editar todos os membros
- O role salvo no formulário vai refletir corretamente no banco
- Barbara terá o mesmo acesso que Raul Seixas (admin)

