
## Separar Cadastros da Configurações

### O que o usuário quer

Criar duas entradas distintas no menu lateral:

1. **Cadastros** (novo item no nav principal, abaixo de Contact Center) — contém apenas as 6 abas operacionais: Credores, Usuários, Equipes, Perfil do Devedor, Tipo de Dívida, Tipo de Status.

2. **Configurações** (item já existente, renomeado/reorganizado) — mantém apenas a seção Sistema com: Integração, Central Empresa, Super Admin e Roadmap.

---

### Estrutura atual vs. estrutura desejada

**Sidebar atual:**
```text
Dashboard
Gamificação
Carteira
[Contact Center]
Perfil → /cadastros  (mostra tudo junto: Cadastros + Sistema)
```

**Sidebar desejada:**
```text
Dashboard
Gamificação
Carteira
[Contact Center]
Cadastros → /cadastros     ← só as 6 abas de cadastro
Configurações → /configuracoes   ← só Sistema (Integração, Central Empresa, etc.)
```

---

### Plano de implementação — 3 arquivos alterados

---

#### 1. `src/pages/CadastrosPage.tsx` — dividir em dois componentes

**A) Manter** `CadastrosPage` com apenas o grupo "Cadastros":
- Remove o grupo "Sistema" inteiramente deste arquivo.
- O título interno muda de "Configurações" para "Cadastros".
- Aba ativa inicial permanece `credores`.

**B) Criar** `src/pages/ConfiguracoesPage.tsx` (já existe como rota `/configuracoes`, mas atualmente não tem conteúdo relevante — será reaproveitado) com o grupo "Sistema":
- Itens: Integração, Central Empresa (tenant_admin), Super Admin (super_admin), Roadmap (tenant_admin).
- Mesma estrutura visual de navegação lateral já usada em `CadastrosPage`.
- Título interno: "Configurações".
- Aba ativa inicial: `integracao`.

---

#### 2. `src/components/AppLayout.tsx` — ajustar navegação lateral

- Renomear o link atual "Perfil" (`/cadastros`) para **"Cadastros"**, com ícone `Database` (ou `Users`).
- Adicionar novo link **"Configurações"** apontando para `/configuracoes`, com ícone `Settings`, logo abaixo de "Cadastros".
- Atualizar `pageTitles` no header: `/cadastros` → `"Cadastros"`, `/configuracoes` → `"Configurações"`.

Ordem final do nav:
```text
Dashboard
Gamificação
Carteira
[Contact Center]
Cadastros        ← /cadastros (ícone Database ou Users)
Configurações    ← /configuracoes (ícone Settings)
```

---

#### 3. `src/pages/ConfiguracoesPage.tsx` — reescrever com a navegação de Sistema

O arquivo atual (`ConfiguracoesPage.tsx`) existe mas provavelmente está vazio ou com conteúdo legado. Será substituído por uma página com a mesma estrutura visual de `CadastrosPage`, porém carregando apenas os itens do grupo Sistema:

- Integração → `<IntegracaoPage />`
- Central Empresa → `<TenantSettingsPage />` (visível para tenant_admin)
- Super Admin → `<SuperAdminPage />` (visível para super_admin)
- Roadmap → `<RoadmapPage />` (visível para tenant_admin)

---

### Resumo visual final

| Rota | Conteúdo |
|---|---|
| `/cadastros` | Credores, Usuários, Equipes, Perfil do Devedor, Tipo de Dívida, Tipo de Status |
| `/configuracoes` | Integração, Central Empresa, Super Admin, Roadmap |

Nenhuma rota nova precisa ser criada — `/configuracoes` já existe no `App.tsx`.
