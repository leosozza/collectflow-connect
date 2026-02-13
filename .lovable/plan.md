

# Configurar Webhook Automaticamente para Receber Conversas

## Problema Identificado

A instancia "TEMIS - Cobranca 01" esta conectada, mas as conversas nao aparecem porque o **webhook da Evolution API nao foi configurado**. Sem o webhook, as mensagens recebidas pelo WhatsApp nao sao enviadas para o sistema, e portanto nenhuma conversa e criada no banco de dados.

O sistema ja possui a logica de webhook pronta (`whatsapp-webhook` edge function e a acao `setWebhook` no `evolution-proxy`), mas **nunca chama automaticamente** a configuracao do webhook ao criar ou conectar uma instancia.

## Solucao

Configurar automaticamente o webhook da Evolution API em dois momentos:
1. Ao **criar** uma nova instancia
2. Ao **conectar/reconectar** (QR Code) uma instancia existente

Adicionalmente, incluir um botao manual para reconfigurar o webhook caso necessario.

## Alteracoes

### 1. Servico (`whatsappInstanceService.ts`)

Adicionar uma nova funcao `setEvolutionWebhook` que chama o `evolution-proxy` com a acao `setWebhook`, passando o `instanceName` e a URL do webhook (`/functions/v1/whatsapp-webhook`).

### 2. Componente (`BaylersInstancesList.tsx`)

- Na funcao `handleCreate`: apos criar a instancia, chamar `setEvolutionWebhook` automaticamente.
- Na funcao `handleConnect`: apos conectar (QR Code), chamar `setEvolutionWebhook` automaticamente.
- Adicionar um botao de "Configurar Webhook" nos botoes de acao de cada instancia, para reconfigurar manualmente se necessario.
- Exibir toast confirmando que o webhook foi configurado.

### 3. Acionar Webhook para Instancia Existente

Como a instancia "TEMIS - Cobranca 01" ja existe e esta conectada, o usuario podera clicar no novo botao de webhook para configura-la sem precisar reconectar.

## Detalhes Tecnicos

- URL do webhook: `{VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`
- Eventos configurados: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`
- A funcao `setWebhook` ja existe no `evolution-proxy` (linhas 208-240), so precisa ser chamada pelo frontend
- Nenhuma alteracao no banco de dados e necessaria

