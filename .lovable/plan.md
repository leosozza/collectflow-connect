

# Plano: Filtro "Higienizados", Atribuir condicional, Exclusão para Auditoria

## 1. Filtro "Higienizados" na Carteira

Adicionar checkbox "Higienizados" ao lado de "Em dia" nos filtros (`ClientFilters.tsx`). Filtra clientes que possuem `enrichment_data IS NOT NULL` (campo JSONB preenchido pela higienização Target Data).

- Adicionar `higienizados: boolean` ao tipo `Filters` em `ClientFilters.tsx`
- Adicionar estado inicial `higienizados: false` em `CarteiraPage.tsx`
- No `displayClients` memo, filtrar `(c as any).enrichment_data != null` quando ativo
- O `fetchClients` já retorna todos os campos, incluindo `enrichment_data`

## 2. Botão "Atribuir" condicional

O botão "Atribuir" na barra de ações em lote só deve aparecer quando **pelo menos um credor** do tenant está configurado com `carteira_mode = "assigned"`. Credores em "Mar Aberto" (`open`) não precisam dessa funcionalidade.

- Em `CarteiraPage.tsx`, derivar `hasAssignedCredor` do `credorModeMap`: `[...credorModeMap.values()].some(m => m === "assigned")`
- Condicionar a renderização do botão "Atribuir" a `hasAssignedCredor`

## 3. Mover exclusão da Carteira para Auditoria

### Remover da Carteira:
- Remover botão de excluir individual (Trash2) da coluna "Ações" na tabela
- Remover botões "Excluir Todos" e "Excluir Quitados" da barra de ações
- Remover os dialogs `bulkDeleteOpen` e `quitadosDeleteOpen` e toda lógica associada
- Remover `deleteMutation`, `deletingClient`, estados de bulk delete, etc.
- Manter a importação `deleteClient` pois será usada na nova página

### Criar aba "Exclusão" dentro de Auditoria:
Transformar `AuditoriaPage.tsx` em componente com **tabs**: "Logs" (conteúdo atual) e "Exclusão de Dados".

A aba "Exclusão de Dados" terá 3 seções:
1. **Exclusão de Importação**: Lista as importações recentes (via `import_logs`), permite excluir todos os clientes de uma importação específica
2. **Exclusão em Lote**: Filtros (credor, status, vencimento, CPF) + botão excluir com re-autenticação por senha
3. **Exclusão Individual**: Campo de busca por nome/CPF, seleciona e exclui com confirmação

### Permissão:
- Usar a permissão existente `canDeleteCarteira` (módulo `carteira`, ação `delete`) para controlar acesso à aba de exclusão
- Admin do tenant tem acesso por padrão (já configurado nos ROLE_DEFAULTS)
- Operadores/supervisores só veem se tiverem permissão `delete` atribuída

## Arquivos a editar

| Arquivo | Ação |
|---|---|
| `src/components/clients/ClientFilters.tsx` | Adicionar checkbox "Higienizados" + campo no tipo Filters |
| `src/pages/CarteiraPage.tsx` | Adicionar filtro higienizados, condicionar Atribuir, remover toda lógica de exclusão |
| `src/pages/AuditoriaPage.tsx` | Reestruturar com tabs: Logs + Exclusão de Dados (3 seções) |

