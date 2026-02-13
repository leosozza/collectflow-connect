

# Preview da Carteira CobCloud Antes de Importar

## Objetivo

Adicionar uma etapa de **sincronizacao/preview** na aba CobCloud que, ao clicar em "Sincronizar", consulta a API e mostra um resumo da carteira disponivel com contadores por status e filtros. O usuario pode entao decidir importar tudo ou apenas um subconjunto filtrado.

## Como vai funcionar

1. O usuario clica em **"Sincronizar com CobCloud"**
2. O sistema consulta a API CobCloud buscando apenas a primeira pagina (limit=1) para cada status, obtendo os totais
3. Um painel de resumo aparece mostrando:
   - Total de titulos disponiveis
   - Quantidade por status (em aberto, pago/quitado, quebrado)
4. O usuario pode selecionar filtros:
   - **Status**: Em aberto, Pago, Quebrado (ou todos)
   - **Periodo de data**: Data inicio e data fim (usando os parametros `date_type` e `date_value` da API)
   - **CPF** especifico (opcional)
5. Apos escolher os filtros, clica em **"Importar Selecionados"** que dispara a importacao completa com paginacao automatica usando os filtros escolhidos

## Alteracoes Tecnicas

### 1. Edge Function `cobcloud-proxy/index.ts` - Nova acao `preview`

Adicionar handler `handlePreview` que:
- Faz chamadas paralelas a API CobCloud `/cli/titulos/listar` com diferentes filtros de status para obter contadores
- Usa `limit=1` em cada chamada para ser rapido e nao consumir rate limit
- Retorna o resumo: `{ total, byStatus: { aberto: N, pago: N, quebrado: N } }`
- Aceita filtros opcionais de data (`date_type`, `date_value`) para contar apenas titulos de um periodo

### 2. Service `cobcloudService.ts` - Novo metodo `preview`

Adicionar metodo que chama a acao `preview` e retorna os totais.

### 3. Edge Function `cobcloud-proxy/index.ts` - Atualizar `import-all`

Adicionar suporte aos parametros de filtro de data (`date_type`, `date_value`) vindos da API CobCloud para que a importacao possa ser filtrada por periodo.

### 4. UI `CobCloudTab.tsx` - Redesign do fluxo de importacao

Substituir os cards de importacao atuais por um fluxo em 2 etapas:

**Etapa 1 - Sincronizar/Preview:**
- Botao "Sincronizar com CobCloud" que busca o resumo
- Card de resumo mostrando contadores por status com icones coloridos
- Cada status e clicavel para selecionar/deselecionar o filtro

**Etapa 2 - Filtros e Importacao:**
- Filtros visiveis apos a sincronizacao:
  - Checkboxes por status (em aberto, pago, quebrado)
  - Seletor de periodo (data inicio / data fim)
  - Campo CPF opcional
- Botao "Importar Tudo" (sem filtro) e "Importar Filtrado" (com filtros selecionados)
- Barra de progresso durante importacao (ja existente)

### 5. Service `cobcloudService.ts` - Atualizar `importAll`

Passar os novos parametros de filtro (status, date_type, date_value) para a edge function.

## Parametros da API CobCloud utilizados

Conforme documentacao oficial:
- `status` - filtro por status do titulo
- `date_type` - tipo de data para filtro (ex: vencimento, cadastro)
- `date_value` - valor da data para filtro
- `documento` - CPF/CNPJ do devedor
- `page` e `limit` - paginacao

