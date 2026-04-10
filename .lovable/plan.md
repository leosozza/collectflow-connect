

# Corrigir barra de progresso real + melhorar logs para volumes grandes

## Problema

1. **Barra de progresso fake**: O frontend usa `setInterval` com incrementos aleatórios (`Math.random() * 5`) — não reflete o progresso real
2. **Timeout em meses grandes**: Uma única chamada à Edge Function processa tudo; volumes como Março excedem o limite de tempo (150-400s)
3. **Falta botão "Copiar Log"**: Existe "Download Logs" mas não "Copiar para clipboard"

## Solução: Processamento em lotes no frontend

Em vez de enviar todos os registros numa única chamada, o frontend dividirá o trabalho em lotes e chamará a Edge Function para cada lote. Isso resolve tanto o progresso real quanto os timeouts.

## Alterações

### 1. Edge Function `maxlist-import/index.ts` — Aceitar lote parcial

Adicionar parâmetros opcionais `items` (array de registros já buscados) e `skip_fetch: true` no body. Quando presentes, a função pula o fetch da API MaxSystem e processa diretamente os itens recebidos. Isso permite que o frontend controle o batching.

Adicionar log no início de cada batch: `[BATCH] Processando registros ${from}-${to} de ${total}`.

### 2. Frontend `MaxListPage.tsx` — Batching com progresso real

**Fluxo para importação/atualização:**
1. Frontend busca todos os dados do MaxSystem (já faz isso na busca)
2. Divide os `rawItems` em lotes de 500-1000 registros
3. Para cada lote, chama `maxlist-import` com `{ items: batch, skip_fetch: true, ... }`
4. Atualiza `importProgress` baseado em `(lotesProcessados / totalLotes) * 100`
5. Agrega os resultados (inserted, updated, rejected, logs) de todos os lotes
6. Exibe o resultado consolidado

```text
Frontend                    Edge Function
   |                             |
   |-- Batch 1 (500 items) ---->|
   |<---- result + logs --------|  → progress = 25%
   |                             |
   |-- Batch 2 (500 items) ---->|
   |<---- result + logs --------|  → progress = 50%
   |                             |
   |-- Batch 3 (500 items) ---->|
   |<---- result + logs --------|  → progress = 75%
   |                             |
   |-- Batch 4 (500 items) ---->|
   |<---- result + logs --------|  → progress = 100%
```

**Texto da barra de progresso**: `"Processando lote 2 de 4 (1000/2000 registros)... 50%"` em vez do genérico "Importando..."

### 3. Frontend `ImportResultDialog.tsx` — Botão "Copiar Log"

Adicionar botão "Copiar Log" ao lado do "Download Logs" no footer, usando `navigator.clipboard.writeText()` com feedback via toast.

### 4. Logs mais detalhados na Edge Function

Adicionar logs de início/fim de cada fase:
- `[FETCH] Iniciando fetch da página N...`
- `[FETCH] Total recebido: X registros em Ys`
- `[BATCH] Processando registros 1-200 de 2000...`
- `[BATCH] Lote finalizado: 180 updated, 15 inserted, 5 unchanged`

## Resultado

- Barra de progresso reflete avanço real (por lote processado)
- Sem timeout: cada chamada processa no máximo 500-1000 registros
- Logs completos com botão de copiar para diagnóstico rápido
- Texto descritivo mostra qual lote está sendo processado

