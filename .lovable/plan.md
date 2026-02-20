
## Reorganização do Menu Lateral

### Problemas Identificados

O menu lateral (`AppLayout.tsx`) contém os seguintes itens que precisam ser removidos ou relocados:

- **Acordos** (linhas 130–147): remover completamente
- **Relatórios** (linhas 149–166): mover para dentro do Dashboard
- **Financeiro** (linhas 168–185): remover completamente
- **Auditoria** (linhas 261–278): mover para dentro de Configurações

### Mudanças por Arquivo

#### 1. `src/components/AppLayout.tsx`
- Remover o bloco completo do link "Acordos" (linhas 130–147)
- Remover o bloco completo do link "Relatórios" (linhas 149–166)
- Remover o bloco completo do link "Financeiro" (linhas 168–185)
- Remover o bloco completo do link "Auditoria" (linhas 261–278)
- Remover importações de ícones não mais usados: `ClipboardList`, `FileText`, `DollarSign`, `BarChart3` (este último ainda é usado no "Painel Super Admin", então manter)

#### 2. `src/pages/DashboardPage.tsx`
- Adicionar um botão "Relatórios" ao lado do botão "Analytics" já existente (linha 140–148)
- O botão usará `navigate("/relatorios")`, ícone `FileText` do lucide-react
- Visibilidade: controlada por `permissions.canViewRelatorios` via `usePermissions`

#### 3. `src/pages/ConfiguracoesPage.tsx`
- Importar `AuditoriaPage` de `@/pages/AuditoriaPage`
- Adicionar item `{ key: "auditoria", label: "Auditoria", icon: Activity }` logo abaixo de "Integração"
- Visibilidade: controlada por `permissions.canViewAuditoria` — só aparece para Admin e Gerente
- Renderizar `{active === "auditoria" && <AuditoriaPage />}` no conteúdo

### Resultado Final do Menu Lateral

```text
ANTES                    DEPOIS
─────────────────────    ─────────────────────
Dashboard                Dashboard
Gamificação              Gamificação
Carteira                 Carteira
Acordos         ❌       Contact Center
Relatórios      ❌         └ Telefonia
Financeiro      ❌         └ WhatsApp
Automação                Automação
Cadastros                Cadastros
Contact Center           ─────────────────────
  └ Telefonia            [rodapé]
  └ WhatsApp             Central Empresa
Auditoria       ❌       Configurações (Auditoria agora aqui)
─────────────────────    Painel Super Admin
[rodapé]                 Sair
Central Empresa
Configurações
Painel Super Admin
Sair
```

### Resultado do Dashboard

Botões de ação no cabeçalho do Dashboard:
```text
[ Relatórios ]  [ Analytics ]  [ Filtro Anos ]  [ Filtro Meses ]
```
O botão "Relatórios" só aparece para usuários com `canViewRelatorios` (Admin, Gerente, Supervisor).

### Resultado de Configurações

Menu lateral de Configurações:
```text
Integração       ← já existia
Auditoria        ← novo, abaixo de Integração
Roadmap
API REST
MaxList (condicional)
```

### Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/components/AppLayout.tsx` | Remover Acordos, Relatórios, Financeiro, Auditoria do nav |
| `src/pages/DashboardPage.tsx` | Adicionar botão "Relatórios" ao lado de Analytics |
| `src/pages/ConfiguracoesPage.tsx` | Adicionar aba "Auditoria" abaixo de Integração |

Nenhuma migração de banco necessária. Nenhum novo componente precisa ser criado.
