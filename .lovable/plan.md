
## Alterações de Navegação e Configurações

### Resumo das mudanças

**5 ajustes em 2 arquivos:**

---

### 1. Arquivo: `src/components/AppLayout.tsx`

**Mudança A — Gamificação abaixo do Dashboard**

Atualmente a ordem no sidebar é:
```text
Dashboard
Carteira
[Contact Center]
Gamificação   ← está em postContactItems (após Contact Center)
```

A nova ordem será:
```text
Dashboard
Gamificação   ← sobe para preContactItems, logo abaixo de Dashboard
Carteira
[Contact Center]
```

Gamificação passa de `postContactItems` para `preContactItems`, inserida na segunda posição.

---

**Mudança B — "Perfil" (Cadastros) como item fixo no menu lateral principal, abaixo de Contact Center**

Atualmente "Configurações" (`/cadastros`) fica no rodapé do sidebar, visível apenas para Admin.

A nova ordem de itens principais será:
```text
Dashboard
Gamificação
Carteira
[Contact Center] (Telefonia / WhatsApp)
Perfil           ← novo item fixo na área de navegação principal
```

O item "Perfil" (com ícone `UserCircle` ou `User`) apontará para `/cadastros`, mas ficará no bloco `<nav>` do sidebar (área scrollável), logo após o Collapsible do Contact Center — visível para todos os usuários autenticados (ou mantendo a restrição de Admin conforme regra atual).

O link "Configurações" no rodapé será removido do bloco `{isAdmin && ...}` para evitar duplicidade, pois o acesso passará a ser pelo item "Perfil" no nav principal.

---

### 2. Arquivo: `src/pages/CadastrosPage.tsx`

**Mudança C — Usuários abaixo de Credores (ainda dentro da seção Cadastros)**

Atualmente o grupo "Cadastros" tem:
```text
Credores
Equipes
Perfil do Devedor
Tipo de Dívida
Tipo de Status
```

E "Pessoas" (grupo separado) tem:
```text
Usuários
```

A mudança move "Usuários" para dentro do grupo "Cadastros", logo abaixo de "Credores", e remove o grupo "Pessoas":
```text
CADASTROS
  Credores
  Usuários   ← sobe aqui
  Equipes
  Perfil do Devedor
  Tipo de Dívida
  Tipo de Status
```

O grupo "Pessoas" deixa de existir como seção separada.

---

**Mudança D — Renomear "Config. Empresa" para "Central Empresa" dentro de Sistema**

Na seção SISTEMA da `CadastrosPage`, a label do item `tenant_config` muda de:
```
"Config. Empresa"
```
para:
```
"Central Empresa"
```

---

**Mudança E — Manter seção "Sistema" no /Configurações**

Nenhuma remoção é feita na seção Sistema. Ela continua com seus itens (Integração, Central Empresa, Super Admin, Roadmap). Confirmado que não há alteração aqui além do rename acima.

---

### Detalhes Técnicos

**`src/components/AppLayout.tsx`:**
- Mover `{ label: "Gamificação", icon: Trophy, path: "/gamificacao" }` de `postContactItems` para `preContactItems` na segunda posição (índice 1, entre Dashboard e Carteira).
- Remover o array `postContactItems` e seu bloco de renderização (ficará vazio após mover Gamificação).
- Adicionar item "Perfil" com ícone `UserCircle` (importado do lucide-react) dentro do `<nav>` scrollável, logo após o `<Collapsible>` do Contact Center — substituindo o link "Configurações" que estava no rodapé.
- Remover o link "Configurações" (`/cadastros`) do bloco `{isAdmin && ...}` no rodapé para evitar duplicidade.
- Atualizar `pageTitles` no header para manter o título correto ao navegar para `/cadastros`.

**`src/pages/CadastrosPage.tsx`:**
- No array `groups`, mover o item `{ key: "usuarios", ... }` para dentro do grupo "Cadastros", na segunda posição (após Credores).
- Remover o grupo "Pessoas" inteiramente.
- Alterar label do item `tenant_config` de `"Config. Empresa"` para `"Central Empresa"`.
