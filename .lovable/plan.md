

# Plano: Paginação configurável e sem limite de seleção na Carteira

## Problema

1. `PAGE_SIZE = 50` é hardcoded — não há seletor para o usuário escolher quantos registros ver por página
2. Não existem controles de paginação (botões anterior/próxima) renderizados na UI, apesar das variáveis `totalPages` e `setUrlPage` existirem no código
3. O discador mostra o count baseado nos selecionados da página atual (máx 50), mas o botão "Selecionar todos os N filtrados" já funciona corretamente

## Solução

### `src/pages/CarteiraPage.tsx`

1. **Substituir `PAGE_SIZE = 50` por estado URL-synced**:
   - Adicionar `useUrlState("pageSize", 50)` 
   - Opções: 50, 100, 200, 500, 1000

2. **Adicionar seletor de itens por página**: Um `Select` compacto ao lado dos controles de paginação com as opções acima

3. **Adicionar controles de paginação**: Renderizar abaixo da tabela:
   - Botão "Anterior" (desabilitado na página 1)
   - Indicador "Página X de Y" 
   - Botão "Próxima" (desabilitado na última página)
   - Ao trocar `pageSize`, resetar para página 1

4. **Reset de página ao trocar pageSize**: Quando o usuário muda o tamanho da página, voltar para `page=1`

5. **Limpar seleção ao trocar página/pageSize**: Já existe o `useEffect` que limpa `selectAllFiltered` — adicionar limpeza de `selectedIds` também ao trocar `pageSize`

## Fluxo

```text
Usuário filtra → vê 50 por página (default)
  ↓
Muda para 500 por página via Select
  ↓
Página reseta para 1, RPC busca 500 registros
  ↓
Seleciona todos da página (500) → banner "Selecionar todos os N filtrados"
  ↓
Clica → todos os IDs carregados → Discador/WhatsApp recebe todos
```

## Arquivo Afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/CarteiraPage.tsx` | `pageSize` via URL state, seletor de tamanho, controles de paginação |

Nenhuma alteração em banco, RPC ou serviços.

