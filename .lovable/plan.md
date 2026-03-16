

## Plano: URL State & Search Params — Implementado ✅

### O que foi feito

1. **Criado** `src/hooks/useUrlState.ts` — Hook genérico com overloads para string, number, boolean e string[]
2. **Migradas 15 páginas** de `useState` local para URL search params:

#### Alta Prioridade (filtros complexos)
- ✅ `CarteiraPage` — 18 filtros + viewMode + sort sincronizados na URL
- ✅ `ClientsPage` — 18 filtros sincronizados na URL
- ✅ `AcordosPage` — statusFilter, credorFilter, searchQuery
- ✅ `RelatoriosPage` — year, month, credor, operator, status, tipoDivida, tipoDevedor, quitação
- ✅ `AnalyticsPage` — years[], months[], operators[], credores[] (arrays)

#### Média Prioridade (tabs e filtros simples)
- ✅ `CadastrosPage` — tab ativa
- ✅ `AutomacaoPage` — tab ativa
- ✅ `GamificacaoPage` — tab ativa
- ✅ `ContactCenterPage` — tab ativa
- ✅ `FinanceiroPage` — mês selecionado
- ✅ `ConfiguracoesPage` — tab ativa (refatorado de useSearchParams manual)
- ✅ `AdminUsuariosHubPage` — tab ativa (refatorado de useSearchParams manual)

#### Baixa Prioridade (CRM)
- ✅ `CRMLeadsPage` — search, filterStatus
- ✅ `CRMActivitiesPage` — search, filterType, filterStatus
- ✅ `SupportAdminPage` — statusFilter

### Benefícios
- URLs compartilháveis com filtros pré-aplicados
- F5 mantém filtros intactos
- Botões Voltar/Avançar do browser funcionam
- Deep linking para tabs específicas
