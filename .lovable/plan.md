
# Corrigir Contagem Total de Titulos no Preview CobCloud

## Problema

A API CobCloud nao retorna um campo `total` na resposta. O formato e:
```text
{"value":{"limit":1,"page":1,"query":[{...}]}}
```

Quando usamos `limit=1`, a funcao `extractTotal` nao encontra campo `total`, `count`, etc., entao usa `fallbackArray.length` que e 1. Resultado: conta apenas 1 registro por status, totalizando 2 em vez de milhares.

## Solucao

Alterar a estrategia de contagem no `handlePreview`: em vez de usar `limit=1` (que retorna apenas 1 registro e nao tem campo de total), usar um limite grande (ex: `limit=99999`) para que o array `value.query` retorne todos os registros e possamos contar pelo tamanho do array.

### Alteracoes em `cobcloud-proxy/index.ts`

1. **Na funcao `handlePreview`**: Trocar `limit=1` por `limit=99999` nos parametros de contagem (tanto para o total geral quanto para cada status)
2. **Na funcao `detectEndpoint`**: Manter `limit=1` pois so precisa verificar se existe dado (nao precisa contar)

### Detalhes tecnicos

```text
handlePreview - baseParams:
  ANTES: limit=1 (retorna 1 item, conta 1)
  DEPOIS: limit=99999 (retorna todos os itens, conta pelo array.length)
```

Isso resolve o problema porque a contagem passa a ser feita pelo tamanho real do array retornado pela API, que contera todos os registros disponiveis.

Nenhuma alteracao na UI ou no service e necessaria.
