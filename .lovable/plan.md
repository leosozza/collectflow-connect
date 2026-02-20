
## Mover "Central Empresa" para Rota Própria no Menu Principal

### Problema atual
"Central Empresa" está dentro de `/configuracoes` como uma aba interna. O usuário quer que seja uma **página própria** no menu principal da sidebar, e que dentro de `/configuracoes` reste apenas o grupo **Sistema** (Integração, Roadmap, API REST, MaxList).

---

### O que será feito

#### 1. Nova rota `/central-empresa` — `src/App.tsx`
Adicionar uma rota dedicada que renderiza `<TenantSettingsPage />` dentro do `AppLayout`, acessível via `/central-empresa`.

#### 2. Sidebar — `src/components/AppLayout.tsx`
- Alterar o link **"Central Empresa"** no rodapé da sidebar para apontar para `/central-empresa` (rota própria) em vez de `/configuracoes?tab=central_empresa`.
- Adicionar active state correto: highlight quando `location.pathname === "/central-empresa"`.
- Adicionar `/central-empresa` ao mapa de títulos do header.

#### 3. Configurações — `src/pages/ConfiguracoesPage.tsx`
- Remover o grupo **"Empresa"** (que continha "Central Empresa").
- Remover a renderização `{active === "central_empresa" && <TenantSettingsPage />}`.
- Remover o import de `TenantSettingsPage` e o ícone `Building2` (não mais necessários).
- O `defaultTab` passa a ser `"integracao"` (primeiro item do grupo Sistema).

---

### Estrutura final

**Menu lateral (rodapé) — Admin / Super Admin:**
```
Nome do Admin
Central Empresa  →  /central-empresa  (página própria)
Configurações    →  /configuracoes    (apenas Sistema: Integração, Roadmap, API REST, MaxList)
[Painel Super Admin  →  /admin/tenants  (somente Super Admin)]
Sair
```

**Dentro de `/configuracoes` — grupo Sistema:**
```
Integração
Roadmap
API REST
MaxList  (apenas tenants maxfama/temis)
```

---

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Adicionar rota `/central-empresa` com `<TenantSettingsPage />` |
| `src/components/AppLayout.tsx` | Atualizar link "Central Empresa" para `/central-empresa` + active state + título no header |
| `src/pages/ConfiguracoesPage.tsx` | Remover grupo "Empresa", remover renderização de `central_empresa`, limpar imports |
