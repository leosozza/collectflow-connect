

# Correção: Limite de 1000 registros na Carteira

## Problema

A função `fetchClients` no `clientService.ts` não define `.limit()`, então o Supabase aplica o limite padrão de **1000 linhas**. Com ~6819 clientes no banco, apenas 1000 são retornados. Após agrupamento por CPF único no frontend, aparecem ~241 clientes.

Esse mesmo limite de 1000 também afeta as queries de `agreements` e `call_dispositions` na CarteiraPage.

## Solução

Implementar **paginação automática** no `fetchClients` para buscar todos os registros em lotes, e aplicar o mesmo padrão nas demais queries afetadas.

### 1. Criar helper de paginação (`src/lib/supabaseUtils.ts`)

Função utilitária `fetchAllRows` que faz queries em lotes de 1000 registros até esgotar os resultados:

```typescript
export async function fetchAllRows(query, pageSize = 1000) {
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    allData.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}
```

### 2. Atualizar `fetchClients` (`src/services/clientService.ts`)

Usar `.range()` em loop para buscar todos os registros em vez de uma única query limitada a 1000.

### 3. Atualizar queries na CarteiraPage

Aplicar o mesmo padrão nas queries de `agreements` (linha 184) e `call_dispositions` (linha 198-201) que também podem atingir o limite de 1000.

## Resultado

Todos os clientes importados aparecerão na Carteira, sem limite artificial de 1000 registros.

