

## Plano: Corrigir rota /central-empresa (erro 404)

### Problema
O link "Central da Empresa" no sidebar aponta para `/central-empresa`, mas essa rota não está registrada no `App.tsx`, causando o erro 404.

### Correção em `src/App.tsx`

Adicionar a rota `/central-empresa` renderizando `TenantSettingsPage` dentro do layout protegido, seguindo o mesmo padrão das demais rotas:

```tsx
<Route
  path="/central-empresa"
  element={
    <ProtectedRoute requireTenant>
      <AppLayout>
        <TenantSettingsPage />
      </AppLayout>
    </ProtectedRoute>
  }
/>
```

O import de `TenantSettingsPage` já existe no arquivo.

### Arquivo alterado
- `src/App.tsx`

