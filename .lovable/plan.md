

# Backfill de Score para CPFs com Eventos Existentes

## Situação
- O trigger automático só atua em **novos** `INSERT` na `client_events`
- **357 CPFs** já possuem eventos mas score = 0
- Nenhum score foi calculado até agora

## Solução

Executar a Edge Function `calculate-propensity` **sem filtro de CPF** (modo batch), que já percorre todos os CPFs com eventos e calcula o score de cada um. Isso pode ser feito de duas formas:

### Opção 1: Via botão existente na CarteiraPage
O botão "Recalcular Score" já chama a função no modo batch. Basta clicar.

### Opção 2: Chamada direta (mais confiável para volume)
Invocar a função via código sem CPF específico, processando todos os 357 CPFs em lote.

## Implementação recomendada
Criar um script de backfill temporário que:
1. Busca todos os CPFs distintos em `client_events`
2. Chama `calculate-propensity` em batches de 50 CPFs
3. Loga progresso

Após o backfill, os novos eventos continuam sendo processados automaticamente pelo trigger.

## Escopo
- Nenhuma alteração de schema ou trigger
- Apenas execução da função existente para os dados históricos

