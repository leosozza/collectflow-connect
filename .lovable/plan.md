

# Sidebar com Aba "Avançado" Colapsável

## O que será feito

Reorganizar os itens do sidebar em grupos, criando uma seção **"Avançado"** colapsável (accordion/collapsible) que agrupa itens administrativos, e uma seção **"Super Admin"** separada para o item Tenants.

### Estrutura do Sidebar

```text
--- Itens principais (sempre visíveis) ---
  Dashboard
  Carteira
  Relatórios        (admin)
  Acordos           (admin)
  Financeiro        (admin)
  Integração        (admin)

--- Avançado (colapsável, admin) ---
  Configurações
  Automação
  Usuários
  Log de Importações
  Empresa
  Auditoria

--- Super Admin (colapsável, super_admin) ---
  Tenants
```

### Comportamento
- A seção "Avançado" começa fechada e pode ser expandida clicando no título
- Quando o sidebar está colapsado (modo ícone), a seção mostra apenas os ícones dos itens (sem o título do grupo)
- A seção "Super Admin" segue o mesmo padrão colapsável
- Se a rota ativa estiver dentro de um grupo colapsável, o grupo abre automaticamente

---

## Detalhes Técnicos

### Arquivo: `src/components/AppLayout.tsx`

1. **Reorganizar `navItems`** em dois arrays:
   - `mainNavItems`: Dashboard, Carteira, Relatórios, Acordos, Financeiro, Integração
   - `advancedNavItems` (admin): Configurações, Automação, Usuários, Log de Importações, Empresa, Auditoria
   - `superAdminNavItems` (super_admin): Tenants

2. **Adicionar estado** `advancedOpen` e `superAdminOpen` para controlar a expansão dos grupos colapsáveis

3. **Renderizar a seção "Avançado"** usando um botão toggle com ícone de chevron que expande/colapsa a lista de itens. Quando a rota ativa pertence ao grupo, o grupo abre automaticamente via `useEffect`.

4. **Mover "Log de Importações"** de item principal para dentro do grupo "Avançado" (apenas para admins; operadores não verão este item, pois todo o grupo é admin-only). Caso operadores precisem acessar Log de Importações, ele permanecerá nos itens principais também.

**Nota:** Como operadores atualmente veem "Log de Importações", ele será mantido nos itens principais para operadores e movido para "Avançado" apenas para admins (evitando perda de acesso).

| Arquivo | Ação |
|---------|------|
| `src/components/AppLayout.tsx` | Modificar - reorganizar nav em grupos com seção colapsável |

