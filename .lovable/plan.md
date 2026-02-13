
# Corrigir Sincronizacao CobCloud - Parser de Resposta Incorreto

## Problema Identificado

Analisando os logs da edge function, encontrei **dois problemas criticos**:

### 1. O parser nao reconhece o formato de resposta da API CobCloud

A API CobCloud retorna dados neste formato:
```text
{"value":{"limit":1,"page":1,"query":[{...},{...}]}}
```

Porem, a funcao `extractArray` procura por `data`, `titulos`, `devedores`, `results` - mas **nunca procura por `value.query`**, entao sempre retorna um array vazio `[]`.

Da mesma forma, `extractTotal` procura por `total`, `count`, `totalCount` - mas o campo total da API pode estar em `value.total` ou simplesmente nao existir.

Isso explica por que o `detectEndpoint` sempre diz "No data found in either endpoint" mesmo recebendo dados validos.

### 2. Os filtros de status "pago" e "quebrado" causam erro 500

Os logs mostram claramente:
```text
status=pago error: 500 "Ocorreu um erro interno"
status=quebrado error: 500 "Ocorreu um erro interno"
```

Apenas `status=aberto` funciona. O status real dos titulos na API inclui valores como "aberto" e "baixado" (nao "pago" ou "quebrado"). Os filtros estao usando valores incorretos que a API nao reconhece.

## Solucao

### 1. Edge Function `cobcloud-proxy/index.ts`

**Corrigir `extractArray`** para reconhecer o formato real da API:
- Adicionar verificacao para `data?.value?.query` (formato principal do CobCloud)
- Manter os fallbacks existentes para compatibilidade

**Corrigir `extractTotal`** para buscar o total no formato correto:
- Verificar `data?.value?.total` e `data?.value?.count`
- Se nao houver campo de total, usar o tamanho do array

**Corrigir `handlePreview`** para nao depender de status invalidos:
- Buscar o total geral SEM filtro de status (apenas uma chamada sem filtro)
- Tentar apenas o status "aberto" (que funciona)
- Para "baixado" (equivalente a pago no CobCloud), tentar com esse valor
- Tratar erros 500 graciosamente sem quebrar a contagem total
- Remover "quebrado" ou tentar valores alternativos da API

**Atualizar o `mapStatus`** e os status cards na UI:
- Usar "aberto" e "baixado" como valores reais da API
- Mapear "baixado" para "Pago/Quitado" na interface

### 2. UI `CobCloudPreviewCard.tsx`

- Atualizar STATUS_CONFIG para usar os valores reais da API: "aberto" e "baixado"
- Ao sincronizar, mostrar o total geral mesmo que contagens por status falhem
- Adicionar card para status "baixado" no lugar de "pago"

### 3. Service `cobcloudService.ts`

- Sem alteracoes necessarias (os filtros sao passados da UI para a edge function)

## Resumo das correcoes

```text
extractArray(data):
  ANTES: verifica data, titulos, devedores, results
  DEPOIS: verifica value.query, data, titulos, devedores, results

extractTotal(data):
  ANTES: verifica total, count, totalCount
  DEPOIS: verifica value.total, value.count, total, count, totalCount

handlePreview:
  ANTES: filtra por "aberto", "pago", "quebrado" (2 causam erro 500)
  DEPOIS: busca total sem filtro + filtra por "aberto", "baixado"

STATUS_CONFIG na UI:
  ANTES: aberto, pago, quebrado
  DEPOIS: aberto, baixado (+ total geral como referencia)
```
