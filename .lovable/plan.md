

# Plano: Corrigir seleção global para Discador, WhatsApp e Higienizar

## Problema confirmado

Todas as ações em massa (Discador, WhatsApp **e Higienizar**) usam `selectedClients`, que é filtrado de `displayClients` (apenas a página atual). Quando `selectAllFiltered` está ativo, apenas ~1.000 registros da página corrente são passados, em vez dos 11.137 filtrados.

## Correção

### 1. Nova função `fetchAllCarteiraClients` em `src/services/clientService.ts`

Busca todos os dados completos dos clientes filtrados via RPC `get_carteira_grouped` em loop paginado (5.000 por batch). Retorna os campos necessários: `representative_id`, `cpf`, `nome_completo`, `phone`, `credor`, `valor_parcela`.

### 2. Atualizar `src/pages/CarteiraPage.tsx`

Quando `selectAllFiltered=true` e o usuário abre Discador, WhatsApp ou Higienizar:
- Buscar todos os clientes filtrados via `fetchAllCarteiraClients`
- Mostrar loading durante a busca
- Passar os dados completos para o dialog

Quando `selectAllFiltered=false`, manter comportamento atual (filtrar de `displayClients`).

### Impacto

- Discador, WhatsApp e Higienizar receberão todos os registros selecionados
- Nenhuma alteração nos componentes dos dialogs
- Nenhuma alteração no SQL

| Arquivo | Alteração |
|---|---|
| `src/services/clientService.ts` | Nova função `fetchAllCarteiraClients` |
| `src/pages/CarteiraPage.tsx` | Fetch completo quando selectAllFiltered=true |

