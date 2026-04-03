

# Plano: Ajustes Finais da Gestão de Campanhas

## Problemas Identificados

1. **Debounce quebrado**: `useMemo` retorna uma função que cria timer mas nunca limpa o anterior — cada keystroke empilha timeouts
2. **Campo `phone` errado em `conversations`**: a tabela usa `remote_phone`, não `phone` — a aba de Respostas está **100% quebrada** (nunca encontra match)
3. **Listagem sem paginação real**: `fetchManagedCampaigns` usa `.range(0, 99)` fixo, sem controle de página no frontend
4. **`fetchRecipientStatusCounts` carrega todos os registros**: seleciona `status` de TODOS recipients para agregar no JS — ineficiente com campanhas grandes
5. **Acordos sem refinamento adicional possível** sem alterar schema — manter correlação mas com janela ajustada

## Alterações

### 1. Debounce correto (`CampaignManagementTab.tsx`)

Substituir o `useMemo`/`setTimeout` por `useEffect` com cleanup:

```typescript
const [debouncedSearch, setDebouncedSearch] = useState("");
useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchInput), 500);
  return () => clearTimeout(timer);
}, [searchInput]);
```

Remover `debounceTimer`, `handleSearchChange`. Input usa `setSearchInput` direto.

### 2. Corrigir `fetchCampaignResponses` — usar `remote_phone`

Na query de conversations (linha 506-512):
- Trocar `.select("id, phone, ...")` para `.select("id, remote_phone, ...")`
- No matching (linha 519): usar `conv.remote_phone` em vez de `conv.phone`

Adicionalmente, melhorar a confiabilidade buscando apenas conversas que tiveram mensagem inbound real (via `chat_messages`) em vez de confiar só na existência da conversa. Buscar `chat_messages` com `direction = 'inbound'` para os `conversation_id` encontrados, dentro da janela temporal.

### 3. Paginação real na listagem (`CampaignManagementTab` + service)

**Service**: `fetchManagedCampaigns` recebe `page` e `pageSize`, usa `.range()` dinâmico. Retorna `PaginatedResult<CampaignWithStats>`.

Adicionar `{ count: "exact" }` à query para retornar o total.

**Frontend**: Adicionar estado `page`, botões Anterior/Próximo, mostrar "Página X de Y".

### 4. Otimizar `fetchRecipientStatusCounts`

Atualmente seleciona TODOS os `status` e agrega em JS. Com campanhas de 10k+ recipients, isso é pesado. Otimizar selecionando apenas `status` e mantendo a agregação JS (Supabase JS client não suporta GROUP BY direto), mas adicionar `.limit(50000)` como safety net.

### 5. Acordos — refinar correlação

Adicionar filtro para excluir acordos com `portal_origin = true` (vieram do portal, não da campanha) e acordos com `status = 'rejected'` para reduzir ruído.

### 6. Respostas — melhorar confiabilidade

Após encontrar conversas por `remote_phone`, verificar se existe pelo menos 1 `chat_message` com `direction = 'inbound'` nessa conversa dentro da janela temporal. Isso elimina conversas criadas automaticamente pelo sistema que nunca tiveram resposta real do cliente.

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/services/campaignManagementService.ts` | Corrigir `remote_phone`, paginação em `fetchManagedCampaigns`, refinar respostas com inbound check, excluir portal_origin em acordos |
| `src/components/contact-center/whatsapp/CampaignManagementTab.tsx` | Debounce correto com `useEffect`, paginação com controles |

Nenhuma migration. Nenhuma alteração em tabelas, edge functions, disparo ou automação.

