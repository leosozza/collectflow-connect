

# Corrigir flash de carregamento ao focar na aba

## Alteração

### `src/hooks/useTenant.tsx` — linha 78

Trocar:
```typescript
setLoading(true);
```
Por:
```typescript
if (!tenant) setLoading(true);
```

Isso garante que o spinner só aparece no primeiro carregamento. Nas atualizações subsequentes (foco de aba, refresh de sessão), os dados são buscados silenciosamente e os estados (`setTenant`, `setTenantUser`, `setPlan`) continuam sendo atualizados normalmente sem desmontar a interface.

