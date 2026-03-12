

# Corrigir: Permissões do Perfil não aplicadas na prática

## Problema

O sistema possui **duas fontes de permissão desconectadas**:

| Componente | O que faz | Tabela |
|---|---|---|
| UserPermissionsTab (UI) | Salva permissões em **permission_profiles** | `permission_profiles` |
| usePermissions (hook) | Lê permissões de **user_permissions** | `user_permissions` |

O hook `usePermissions` nunca consulta `permission_profiles`. Por isso, qualquer alteração feita na tela de permissões **não tem efeito**.

## Solução

Alterar o `usePermissions` para:

1. Chamar o RPC `get_my_permission_profile` (já existe no banco)
2. Se o usuário tiver um perfil de permissão atribuído (`permission_profile_id`), usar as permissões desse perfil como base
3. Se não tiver perfil atribuído, manter o fallback para os defaults hardcoded por role
4. Manter os overrides individuais (`user_permissions`) como camada final (caso existam)

## Arquivo

| Arquivo | Ação |
|---|---|
| `src/hooks/usePermissions.ts` | Adicionar query para `get_my_permission_profile`, usar como fonte primária de permissões |

## Lógica de prioridade

```text
1. Perfil de permissão atribuído (permission_profiles) → fonte primária
2. Se não tem perfil → ROLE_DEFAULTS hardcoded (fallback)
3. Overrides individuais (user_permissions) → aplicados por cima
```

## Detalhes técnicos

```typescript
// Nova query no usePermissions
const { data: permProfile } = useQuery({
  queryKey: ["my-permission-profile", tenantUser?.user_id],
  queryFn: async () => {
    const { data } = await supabase.rpc("get_my_permission_profile");
    return data?.[0] ?? null;
  },
  enabled: !!tenantUser,
});

// Build effective permissions
const base = permProfile?.permissions
  ? permProfile.permissions   // from assigned profile
  : ROLE_DEFAULTS[role];      // fallback to hardcoded

// Then apply individual overrides on top
for (const override of overrides) {
  base[override.module] = override.actions;
}
```

