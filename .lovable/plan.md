

# Mover Permissões e Grade de Comissão para dentro de Usuários (com abas)

## Resumo
Remover o grupo "Acesso" do menu lateral de Cadastros e incorporar **Permissões** e **Grade de Comissão** como abas dentro da seção Usuários, usando o componente `Tabs`.

## Mudanças

### 1. `src/pages/UsersPage.tsx`
- Envolver o conteúdo atual em uma estrutura de `Tabs` com 3 abas:
  - **Usuários** (conteúdo atual do UsersPage)
  - **Permissões** (`UserPermissionsTab`)
  - **Grade de Comissão** (`CommissionGradesTab`)
- Importar `Tabs, TabsList, TabsTrigger, TabsContent` e os dois componentes

### 2. `src/pages/CadastrosPage.tsx`
- Remover o grupo "Acesso" inteiro (itens `permissoes` e `grade_comissao`)
- Remover as renderizações condicionais para `permissoes` e `grade_comissao`
- Remover imports não usados: `UserPermissionsTab`, `CommissionGradesTab`, `Shield`, `TrendingUp`

### Estrutura final do menu Cadastros
```text
Cadastros
  Credores | Usuários | Equipes | Perfil do Devedor | Tipo de Dívida | Tipo de Status | Categorização da Chamada
```

### Estrutura das abas dentro de Usuários
```text
[Usuários] [Permissões] [Grade de Comissão]
```

