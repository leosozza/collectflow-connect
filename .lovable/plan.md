

# Importacao Completa da Carteira CobCloud com Paginacao Automatica

## Problema Atual

A importacao atual busca apenas **uma unica pagina** da API CobCloud (maximo 500 registros). Para importar a carteira inteira, o usuario precisaria clicar repetidamente mudando a pagina manualmente. Alem disso, nao ha protecao contra o rate limit (HTTP 429) da API.

## Solucao

Criar uma acao **"Importar Carteira Completa"** que percorre automaticamente todas as paginas da API CobCloud ate nao haver mais registros, com:

- Paginacao automatica (loop pagina a pagina)
- Pausa entre requisicoes para evitar 429 (rate limit)
- Retry automatico com backoff quando receber 429
- Progresso em tempo real na interface (pagina atual, registros importados)
- Opcao de cancelar a importacao

## Alteracoes

### 1. Edge Function `cobcloud-proxy/index.ts` - Nova acao `import-all`

Adicionar handler `handleImportAll` que:
- Percorre todas as paginas da API (`/cli/titulos/listar`) em lotes de 200 registros por pagina
- Ao receber uma pagina vazia ou com menos registros que o limite, para o loop
- Se receber HTTP 429, aguarda 2 segundos e tenta novamente (ate 3 retries)
- Usa upsert em batch (agrupando registros) em vez de insert/update individual para performance
- Retorna totais: `{ imported, skipped, pages, total }`
- Limite de seguranca: maximo 50 paginas por execucao (10.000 registros)

### 2. Service `cobcloudService.ts` - Novo metodo

Adicionar `importAll` que chama a acao `import-all` com filtros opcionais (cpf, status).

### 3. UI `CobCloudTab.tsx` - Botao "Importar Tudo"

- Adicionar botao "Importar Carteira Completa" ao lado do botao de importacao atual
- Mostrar barra de progresso durante a importacao com:
  - Numero de paginas processadas
  - Total de registros importados ate o momento
- Manter o botao de importacao por pagina para importacoes parciais/filtradas

## Detalhes Tecnicos

### Fluxo da paginacao na Edge Function

```text
pagina = 1
total_importados = 0

LOOP:
  GET /cli/titulos/listar?page={pagina}&limit=200
  
  SE 429 -> aguarda 2s, retry (max 3x)
  SE vazio ou < 200 resultados -> processa e ENCERRA
  SE pagina > 50 -> ENCERRA (limite de seguranca)
  
  processa registros (upsert no banco)
  total_importados += importados
  pagina++
  aguarda 500ms (rate limit preventivo)

RETORNA { imported, skipped, pages, total }
```

### Upsert em batch

Em vez de verificar e inserir/atualizar um registro por vez (N queries por registro), usar upsert do Supabase com `onConflict` para processar multiplos registros de uma vez, reduzindo drasticamente o numero de queries ao banco.

### Endpoint existente de importacao por pagina

O endpoint `import-titulos` existente continua funcionando normalmente para importacoes parciais com filtros especificos (por CPF, por status, etc).
