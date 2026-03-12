

# Plano: Configurar Token de Verificação do Webhook Target Data

## Contexto
A Target Data gerou um token de verificação ao registrar o webhook. Este token precisa ser armazenado como secret `TARGETDATA_WEBHOOK_SECRET` para que a edge function `targetdata-webhook` valide as requisições recebidas.

A edge function já possui a lógica de validação implementada — ela compara o header `x-webhook-secret` com o secret `TARGETDATA_WEBHOOK_SECRET`. Só falta adicionar o secret.

## Ação
1. Adicionar o secret `TARGETDATA_WEBHOOK_SECRET` com o valor `249eee3083966177929d885c2fb3a578b2c53b29e64e1a5a50452e0c421c498b`

Nenhuma alteração de código necessária — a validação já está implementada no webhook.

