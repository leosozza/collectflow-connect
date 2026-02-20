
## Corrigir Rodapé do Sidebar para Super Admin

### Problema
O bloco `{isSuperAdmin ? (...) : (...)}` usa um ternário exclusivo. Quando o usuário é Super Admin, o branch `else` — que contém o Nome, Central Empresa e Configurações — nunca é renderizado.

### Solução
Substituir o ternário por blocos independentes, controlados separadamente:

**Nova estrutura do rodapé para Super Admin:**
```
Nome do Admin         (sempre visível, exceto collapsed)
Central Empresa       (isTenantAdmin, incluindo Super Admin)
Configurações         (isTenantAdmin, incluindo Super Admin)
Painel Super Admin    (apenas isSuperAdmin)
Sair                  (sempre)
```

**Nova estrutura do rodapé para Admin:**
```
Nome do Admin
Central Empresa
Configurações
Sair
```

**Nova estrutura para Operador:**
```
Sair
```

### Mudança técnica em `src/components/AppLayout.tsx`

Substituir o bloco `{isSuperAdmin ? (...) : (...)}` (linhas 171–220) por:

```tsx
{/* Nome do usuário — visível para todos os admins */}
{!collapsed && isTenantAdmin && (
  <div className="px-4 py-2 mb-2">
    <p className="...">{profile?.full_name}</p>
    <p className="...">{tenantUser?.role}</p>
  </div>
)}

{/* Central Empresa — para todos os admins */}
{isTenantAdmin && (
  <Link to="/configuracoes">Central Empresa</Link>
)}

{/* Configurações — para todos os admins */}
{isTenantAdmin && (
  <Link to="/configuracoes">Configurações</Link>
)}

{/* Painel Super Admin — apenas Super Admin */}
{isSuperAdmin && (
  <Link to="/admin/tenants">Painel Super Admin</Link>
)}

{/* Sair — sempre visível */}
<button onClick={handleSignOut}>Sair</button>
```

Apenas 1 arquivo alterado: `src/components/AppLayout.tsx`.
