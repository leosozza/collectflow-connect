

# Reestruturar Sidebar do Super Admin com Grupos Colapsáveis

## Resumo

Reorganizar os itens de navegação do `SuperAdminLayout.tsx` em grupos colapsáveis usando o componente `Collapsible` já existente no projeto. Dashboard fica fixo no topo, demais itens agrupados conforme especificado.

## Alteração única: `src/components/SuperAdminLayout.tsx`

### Estrutura dos grupos

```text
Dashboard (fixo, sempre visível)

OPERAÇÃO ▼
  Suporte (/admin/suporte)
  Gestão de Equipes (/admin/equipes)
  Treinamentos e Reuniões (/admin/treinamentos)

AUTOMAÇÃO E SERVIÇOS ▼
  Serviços e Tokens (/admin/servicos)
  Relatórios e Análises (/admin/relatorios)
  Integrações (/admin/configuracoes)  ← renomeado

GESTÃO DE CLIENTES ▼
  Gestão de Inquilinos (/admin/tenants)

ADMINISTRAÇÃO ▼
  Gestão Financeira (/admin/financeiro)

CONFIGURAÇÕES ▼
  Roadmap (/admin/roadmap)
```

### Implementação

- Substituir o array flat `navItems` por uma estrutura de grupos `{ groupLabel, items[] }`
- Dashboard permanece como item avulso no topo (fora de qualquer grupo)
- Cada grupo usa `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` (já importado no projeto)
- Grupo expande automaticamente se contém a rota ativa
- Quando sidebar está colapsado (`collapsed=true`), mostrar apenas ícones sem labels de grupo
- Renomear "Configurações do Sistema" para "Integrações" no sidebar e no `pageTitles`
- Remover "Permissões e Módulos" e "Agentes Digitais" pois não possuem rotas existentes (preparar estrutura para adição futura)
- Separação visual entre grupos com `div` com `border-t border-sidebar-border/30` e padding

### Visual do grupo colapsável

- Label do grupo em texto `text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold` com seta `ChevronDown` que rotaciona
- Subitens com `ml-2` de indentação
- Estilo ativo/hover mantido idêntico ao atual

