
## Reorganização do Rodapé do Menu Lateral + Configurações

### O que será feito

**1. Reordenar o rodapé do menu lateral (`AppLayout.tsx`)**

A nova ordem no bloco inferior da sidebar ficará:

```text
── Para perfil Admin (isTenantAdmin, não isSuperAdmin) ──
  Nome do Admin (info do usuário)
  Central Empresa  → /configuracoes (aba tenant_config)
  Configurações    → /configuracoes
  Sair

── Para perfil Super Admin (isSuperAdmin) ──
  Painel Super Admin → /admin/tenants
  Sair
  (Central Empresa e Configurações ficam ocultos para Super Admin
   pois ele gerencia pelo painel dedicado)
```

> Nota: Como o Super Admin já tem o "Painel Super Admin" dedicado no menu, faz sentido manter o rodapé limpo para ele com apenas esse link + Sair. Caso o usuário queira que o Super Admin também veja Nome + Central Empresa + Configurações, pode solicitar ajuste.

**Mudanças no bloco `<div className="px-2 py-4 border-t...">`:**

- Mover o bloco de **nome do usuário** para **primeiro** (topo do rodapé)
- Logo abaixo: **Central Empresa** (visível apenas para `isTenantAdmin && !isSuperAdmin`)
- Logo abaixo: **Configurações** (visível para `isTenantAdmin && !isSuperAdmin`)
- Para Super Admin: apenas **Painel Super Admin** + **Sair**
- Remover MaxList e API REST do rodapé (eles vão para dentro de Configurações, ver item 2)

**2. Mover API REST e MaxList para dentro de Configurações (`ConfiguracoesPage.tsx`)**

Adicionar dois novos itens ao grupo "Sistema":
- **API REST** → renderiza `<ApiDocsPage />` (visível para `isTenantAdmin`)
- **MaxList** → renderiza `<MaxListPage />` (visível apenas quando `tenant?.slug === "maxfama"` ou `"temis"`)

Isso exige:
- Importar `ApiDocsPage` e `MaxListPage` dentro de `ConfiguracoesPage`
- Importar o hook `useTenant` para acessar `tenant?.slug`
- Adicionar os blocos condicionais de renderização: `{active === "api_docs" && <ApiDocsPage />}` e `{active === "maxlist" && <MaxListPage />}`
- Adicionar os ícones `Code2` e `FileSpreadsheet` dos imports

**3. Mover Central Empresa para aba dedicada dentro de Configurações (já existe)**

A aba `tenant_config` dentro de `ConfiguracoesPage` já renderiza `<TenantSettingsPage />`. O link "Central Empresa" no sidebar passará a ser um atalho direto para `/configuracoes` (que já abre na aba correta por padrão como primeira aba visível). Se necessário, pode-se usar um parâmetro de URL (`?tab=tenant_config`) para abrir diretamente na aba Central Empresa — mas isso é opcional e pode ser feito num segundo momento.

---

### Resumo das mudanças por arquivo

| Arquivo | Mudança |
|---|---|
| `src/components/AppLayout.tsx` | Reordenar rodapé: Nome → Central Empresa → Configurações → Sair (Admin) / Painel Super Admin → Sair (Super Admin). Remover MaxList e API REST do rodapé. |
| `src/pages/ConfiguracoesPage.tsx` | Adicionar itens API REST e MaxList ao grupo Sistema, com imports dos componentes e ícones correspondentes. Remover Central Empresa do grupo (já fica no sidebar como link direto). |

---

### Estrutura final do rodapé por perfil

**Admin (isTenantAdmin, não Super Admin):**
```
Nome do Admin
Central Empresa
Configurações
Sair
```

**Super Admin (isSuperAdmin):**
```
Painel Super Admin
Sair
```

**Operador (nem admin nem super):**
```
Sair
```
