
## Consolidar "Avançado" e "Super Admin" dentro de Configurações

### Objetivo
Remover os grupos "Avançado" e "Super Admin" do sidebar. As páginas `TenantSettingsPage` (/tenant/configuracoes) e `SuperAdminPage` (/admin/tenants) passam a ser acessadas como sub-seções dentro de **Configurações** (/cadastros), junto com Credores, Usuários, Equipes, etc.

---

### Mudanças no Sidebar — `AppLayout.tsx`

Remover completamente:
- O bloco `Collapsible` de "Avançado" (linhas 187–219)
- O bloco `Collapsible` de "Super Admin" (linhas 221–253)
- As variáveis `advancedNavItems`, `superAdminNavItems`, `advancedOpen`, `superAdminOpen`, `isAdvancedRoute`, `isSuperAdminRoute`
- Os `useEffect` que controlam esses estados
- Os imports de `Building2` e `Handshake` se não usados
- A entrada `/tenant/configuracoes` e `/admin/tenants` do mapa `pageTitles` no header (elas serão reconhecidas pelo título da CadastrosPage)

O sidebar fica limpo com apenas: Dashboard, Carteira, Contact Center (dropdown), e no rodapé: Configurações + Sair.

---

### Mudanças em CadastrosPage — `src/pages/CadastrosPage.tsx`

Adicionar duas novas seções condicionais na sub-navegação lateral:

```
sections base (para admins):
  - Credores
  - Usuários
  - Equipes
  - Perfil do Devedor
  - Tipo de Dívida
  - Tipo de Status
  - Integração
  - Configurações Empresa  ← novo (apenas isTenantAdmin)
  - Super Admin            ← novo (apenas isSuperAdmin)
```

As seções são condicionais:
- `Configurações Empresa` aparece somente quando `isTenantAdmin === true`
- `Super Admin` aparece somente quando `isSuperAdmin === true`

No conteúdo principal, adicionar os casos:
```tsx
{active === "tenant_config" && <TenantSettingsPage />}
{active === "super_admin" && <SuperAdminPage />}
```

Importar `useTenant` para obter `isTenantAdmin` e `isSuperAdmin`.
Importar `TenantSettingsPage` e `SuperAdminPage`.

---

### Ícones

- `Configurações Empresa` → ícone `Building2`
- `Super Admin` → ícone `ShieldCheck` (mais expressivo para o super admin)

---

### Arquivos a modificar

| Arquivo | O que muda |
|---|---|
| `src/components/AppLayout.tsx` | Remove blocos "Avançado" e "Super Admin" do sidebar + variáveis relacionadas |
| `src/pages/CadastrosPage.tsx` | Adiciona seções "Configurações Empresa" e "Super Admin" condicionais na sub-nav |

### Nenhuma migração de banco necessária.
### Nenhuma nova dependência necessária.
### As rotas `/tenant/configuracoes` e `/admin/tenants` continuam funcionando normalmente (acessíveis via URL direta, mas os links do sidebar são removidos).
