
## Remover "Super Admin" de /Configurações

### Mudança única — `src/pages/ConfiguracoesPage.tsx`

**O que será removido:**

1. A linha que adiciona o item condicionalmente ao grupo Sistema:
   ```ts
   ...(isSuperAdmin ? [{ key: "super_admin", label: "Super Admin", icon: ShieldCheck }] : []),
   ```

2. O import do ícone `ShieldCheck` (que só era usado nesse item).

3. O import do componente `SuperAdminPage` (que só era renderizado quando `active === "super_admin"`).

4. O bloco de renderização condicional:
   ```tsx
   {active === "super_admin" && <SuperAdminPage />}
   ```

**Resultado:** A aba "Configurações" passa a exibir apenas:
- Integração
- Central Empresa (tenant_admin)
- Roadmap (tenant_admin)

O acesso ao Super Admin continua disponível pelo link **"Painel Super Admin"** no menu lateral principal (rota `/admin/tenants`), que já existe e é visível apenas para `isSuperAdmin`.

Nenhum outro arquivo precisa ser alterado.
