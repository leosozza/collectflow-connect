

# Plano: Resolver WORKER_LIMIT no maxsystem-proxy

## Causa raiz
A paginação em chunks de 5000 já existe, mas o problema persiste porque **todos os chunks são acumulados em `allItems` na memória** antes de retornar. Com 50.000 registros, o array final ultrapassa o limite de memória da Edge Function (~150MB).

## Solução: Delegar paginação ao frontend

Em vez de acumular tudo no proxy, o proxy retorna **um chunk por vez** e o frontend faz múltiplas chamadas.

### 1. Edge Function `maxsystem-proxy/index.ts`
- Remover o loop `while` que acumula todos os chunks
- Aceitar parâmetros `top` (max 5000) e `skip` do frontend
- Fazer **uma única chamada** à API MaxSystem por invocação
- Retornar `{ Items, Count }` — onde `Count` é o total geral para o frontend saber quantas páginas faltam
- Cap `top` em 5000 para nunca estourar memória

### 2. Frontend `MaxListPage.tsx`
- Alterar a função de consulta para fazer chamadas paginadas em loop no frontend:
  - Primeira chamada: `skip=0, top=5000` → obtém `Count` total
  - Chamadas seguintes: `skip=5000, skip=10000...` até cobrir o `Count`
  - Acumula os `Items` no state do React progressivamente
- Mostrar progresso: "Carregando X de Y registros..."
- Manter o comportamento atual de exibição na tabela após carregar tudo

## Resultado
Cada invocação da Edge Function processa no máximo 5000 registros, eliminando o estouro de memória. O frontend gerencia a paginação e exibe progresso ao operador.

