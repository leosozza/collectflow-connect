

# Plano: Selecionar todos os clientes filtrados (não apenas a página)

## Problema

O "Selecionar todos" só seleciona os 50 da página atual porque `allClientIds` é derivado de `displayClients` (limitado ao PAGE_SIZE de 50). Quando o filtro retorna 3.700 resultados, só 50 são selecionáveis.

## Solução

Adicionar um **banner estilo Gmail** que aparece quando todos os 50 da página estão selecionados, permitindo selecionar **todos os N registros filtrados** com um clique. Ao clicar, uma query busca todos os IDs correspondentes aos filtros no banco.

### Fluxo do usuário:
1. Aplica filtro (ex: "Aguardando Acionamento") → 3.700 resultados
2. Clica no checkbox do cabeçalho → seleciona os 50 da página
3. Aparece banner: *"50 clientes desta página selecionados. **Selecionar todos os 3.700 clientes filtrados**"*
4. Clica → busca todos os IDs via RPC → seleção completa
5. Banner muda: *"Todos os 3.700 clientes selecionados. **Limpar seleção**"*

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/clientService.ts` | Nova função `fetchAllCarteiraIds` — chama a mesma RPC `get_carteira_grouped` com page_size grande, retorna apenas os IDs |
| `src/pages/CarteiraPage.tsx` | Novo estado `selectAllFiltered`, banner condicional, integração com dialogs |

## Detalhes técnicos

### 1. `clientService.ts` — nova função

```typescript
export const fetchAllCarteiraIds = async (
  tenantId: string, filters: CarteiraFilters
): Promise<string[]> => {
  // Chama a mesma RPC mas com page_size = 100000 para pegar tudo
  // Retorna apenas os all_ids concatenados
};
```

### 2. `CarteiraPage.tsx` — mudanças

- Novo estado: `const [selectAllFiltered, setSelectAllFiltered] = useState(false)`
- Reset `selectAllFiltered = false` quando filtros mudam ou página muda
- Função `handleSelectAllFiltered`: chama `fetchAllCarteiraIds`, seta os IDs em `selectedIds`
- Banner renderizado entre filtros e tabela quando `selectedIds.size === allClientIds.length && allClientIds.length > 0`
- Os dialogs (WhatsApp, Dialer, Atribuir) já usam `selectedIds` e `selectedClients` — para o caso de "todos filtrados", os dialogs receberão os IDs diretamente (não precisam dos dados completos dos clientes)

