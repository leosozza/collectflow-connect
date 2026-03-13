

# URL State & Search Params — Melhoria de UX em Todo o Sistema

## Problema Atual

O sistema usa `useState` local para filtros, tabs e estado de UI em quase todas as páginas. Isso causa:

- **Filtros perdidos** ao navegar para outra página e voltar
- **Links não compartilháveis** — não é possível enviar um link com filtros pré-aplicados
- **Back/Forward do browser não funcionam** — o botão voltar não restaura o estado anterior
- **Refresh perde tudo** — F5 reseta todos os filtros para o padrão

Apenas 3 páginas usam `useSearchParams` hoje: `ConfiguracoesPage`, `AdminUsuariosHubPage` e `AuthPage` (parcialmente).

## Solução: Hook `useUrlState`

Criar um hook reutilizável que sincroniza estado com URL search params, substituindo `useState` nas páginas principais.

```text
Antes:  const [status, setStatus] = useState("todos")     → URL: /carteira
Depois: const [status, setStatus] = useUrlState("status", "todos") → URL: /carteira?status=pago
```

### Hook `useUrlState`

```typescript
// src/hooks/useUrlState.ts
function useUrlState<T>(key: string, defaultValue: T): [T, (val: T) => void]
function useUrlFilters(defaults: Record<string, string>): [filters, setFilter, clearAll]
```

- Serializa/deserializa automaticamente (strings, números, booleans)
- `replace: true` para não poluir histórico com cada filtro
- Batch updates para múltiplos filtros simultâneos

## Páginas Impactadas (12 páginas)

### Prioridade Alta — Filtros complexos
| Página | Estado a migrar para URL |
|--------|--------------------------|
| `CarteiraPage` | `status`, `credor`, `dateFrom`, `dateTo`, `search`, `viewMode`, `tipoDevedorId`, `tipoDividaId`, `statusCobrancaId`, `semAcordo`, `page`, `sort` |
| `ClientsPage` | Mesmos filtros da Carteira |
| `AcordosPage` | `statusFilter`, `credorFilter`, `searchQuery` |
| `RelatoriosPage` | `year`, `month`, `credor`, `operator`, `status`, `tipoDivida`, `tipoDevedor`, `quitacaoDe`, `quitacaoAte` |
| `AnalyticsPage` | `selectedYears`, `selectedMonths`, `selectedOperators`, `selectedCredores` |

### Prioridade Média — Tabs e filtros simples
| Página | Estado a migrar |
|--------|-----------------|
| `CadastrosPage` | `active` (tab selecionada) |
| `AutomacaoPage` | `activeTab` |
| `GamificacaoPage` | Tab ativa (atualmente via Tabs component sem state) |
| `ContactCenterPage` | `activeTab` |
| `FinanceiroPage` | `month` |
| `ConfiguracoesPage` | Já usa parcialmente — unificar com hook |

### Prioridade Baixa — CRM
| Página | Estado a migrar |
|--------|-----------------|
| `CRMLeadsPage` | `search`, `filterStatus` |
| `CRMActivitiesPage` | `search`, `filterType`, `filterStatus` |
| `SupportAdminPage` | `statusFilter` |

## Arquivos a Criar/Modificar

1. **Criar** `src/hooks/useUrlState.ts` — Hook genérico
2. **Modificar** 12+ páginas — Substituir `useState` por `useUrlState` para filtros/tabs
3. **Modificar** componentes de filtro (`ClientFilters`, `CarteiraFilters`, `ReportFilters`) — Propagar valores da URL

## Benefícios para o Usuário

- Copiar URL com filtros e compartilhar com colega
- Refresh mantém filtros intactos
- Botão voltar restaura estado anterior
- Deep linking direto para tab específica (ex: `/cadastros?tab=credores`)

## Detalhes Técnicos

- O hook usa `useSearchParams` do React Router internamente
- Valores default não aparecem na URL (URL limpa)
- Arrays serializados com vírgula (`?years=2025,2024`)
- Booleans como `?semAcordo=1` / ausente = false
- Números parseados automaticamente

