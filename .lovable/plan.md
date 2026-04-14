

# Análise: Sistema fica atualizando ao entrar no perfil do cliente

## Causa Raiz

O problema está na cascata de re-renders causada pela interação entre `useAuth` e `useTenant`:

### Fluxo atual (problemático)

```text
1. Página monta → useAuth inicia
2. getSession() resolve → setUser(userObj_A), setLoading(false)
   → useTenant useEffect dispara (user mudou)
   → fetchTenantData() → 4 RPCs + 2 queries → setTenant, setTenantUser, setPlan
   → Todos os componentes filhos re-renderizam
   → Todas as queries (client-detail, agreements, tipos_devedor, etc.) re-executam

3. onAuthStateChange(INITIAL_SESSION) dispara → setUser(userObj_B)  ← NOVO objeto, mesmo usuário
   → useTenant useEffect dispara NOVAMENTE (referência de user mudou)
   → fetchTenantData() executa TUDO de novo
   → setTenant(novo obj), setTenantUser(novo obj), setPlan(novo obj)
   → TODOS os componentes re-renderizam DE NOVO
   → TODAS as queries re-executam DE NOVO

4. TOKEN_REFRESHED (a cada ~1h) → mesmo ciclo se repete
```

O `user` no `useAuth` é substituído por um novo objeto a cada evento do Supabase Auth, mesmo que seja o mesmo usuário. Como o `useEffect` em `useTenant` depende de `[user, authLoading]`, ele re-executa `fetchTenantData` toda vez que a referência de `user` muda — recriando objetos de `tenant`, `tenantUser` e `plan`, que por sua vez invalidam todas as queries dependentes.

### Impacto na página do cliente

A `ClientDetailPage` tem ~6 queries (`client-detail`, `client-agreements`, `tipos_devedor`, `tipos_divida`, `tipos_status`, `client_phones`). Cada ciclo de re-render dispara todas elas novamente, causando o efeito visual de "ficar atualizando".

## Solução

### 1. Estabilizar referência do `user` em `useAuth`
Só atualizar o state `user` se o `user.id` realmente mudou:

```typescript
// useAuth.tsx
const setUserStable = (newUser: User | null) => {
  setUser(prev => {
    if (prev?.id === newUser?.id) return prev; // mesma referência
    return newUser;
  });
};
```

### 2. Estabilizar `useTenant` — depender de `user?.id` em vez de `user`
Usar `user?.id` como dependência do useEffect (string primitiva, não muda de referência):

```typescript
// useTenant.tsx
useEffect(() => {
  fetchTenantData();
}, [user?.id, authLoading]);  // ← string primitiva, não objeto
```

### 3. Evitar recriar objetos desnecessariamente em `useTenant`
Só atualizar `tenant`/`tenantUser` se os dados realmente mudaram (comparar IDs).

## Resultado esperado
- Ao entrar no perfil do cliente, os dados carregam **uma única vez**
- Sem flickering ou re-renders em cascata
- Token refresh (a cada ~1h) não causa reload visível

## Arquivos a alterar
- `src/hooks/useAuth.tsx` — estabilizar `setUser`
- `src/hooks/useTenant.tsx` — dependência por `user?.id` e comparação antes de `setState`

## Detalhes técnicos

Nenhuma migration necessária. A correção é puramente frontend, focada em evitar re-renders desnecessários pela estabilização de referências de objetos no React.

