
# Integração WhatsApp na página /integracao

## Resumo

Adicionar uma aba "WhatsApp" na página de Integrações com duas opções de conexão:
1. **Oficial (Gupshup)** - credenciais API + webhook de retorno
2. **Baylers** (Evolution API, sem mencionar o nome real) - chave API + URL da instância

As credenciais serão salvas no campo `settings` (jsonb) da tabela `tenants`, seguindo o padrão já usado para Gupshup e 3CPlus. O GupshupSettings existente será movido de Automação para Integrações e aprimorado com a URL do webhook.

## O que muda

### 1. Nova aba "WhatsApp" na IntegracaoPage

Adicionar uma quarta aba na página `/integracao` com ícone MessageCircle e o texto "WhatsApp".

### 2. Novo componente: `WhatsAppIntegrationTab`

Dentro da aba, exibir dois cards lado a lado (ou empilhados em mobile):

**Card 1 - Oficial (Gupshup)**
- Campo: API Key (com toggle mostrar/ocultar)
- Campo: App Name
- Campo: Número de Origem
- Exibição (read-only): URL do Webhook de retorno
  - Formato: `https://{SUPABASE_URL}/functions/v1/gupshup-webhook`
  - Botão "Copiar" ao lado
- Badge "Configurado" quando todos os campos estiverem preenchidos
- Botão "Salvar credenciais"

**Card 2 - Baylers**
- Campo: URL da Instância (ex: `https://minha-instancia.com`)
- Campo: API Key (com toggle mostrar/ocultar)
- Campo: Nome da Instância
- Badge "Configurado" quando URL + API Key estiverem preenchidos
- Botão "Salvar credenciais"

Ambos salvam em `tenant.settings` com prefixos distintos:
- Gupshup: `gupshup_api_key`, `gupshup_app_name`, `gupshup_source_number`
- Baylers: `baylers_api_key`, `baylers_instance_url`, `baylers_instance_name`

### 3. Mover GupshupSettings de Automação para Integrações

- Remover o `GupshupSettings` da aba "Configurações" do `AutomacaoPage`
- A lógica já estará no novo `WhatsAppIntegrationTab`
- Na aba "Configurações" de Automação, exibir apenas um aviso direcionando para Integrações

### 4. Edge function: `gupshup-webhook`

Nova edge function para receber callbacks do Gupshup (status de entrega, respostas). Registra eventos na tabela `message_logs`. Isso permite que o admin cole a URL no painel do Gupshup.

### 5. Atualizar `send-bulk-whatsapp` para suportar Baylers

A edge function de disparo em lote verificará qual provedor está configurado (`gupshup_api_key` ou `baylers_api_key`) e usará a API correspondente.

## Arquivos

### Criar
| Arquivo | Descrição |
|---|---|
| `src/components/integracao/WhatsAppIntegrationTab.tsx` | Componente com os dois cards (Gupshup + Baylers) |
| `supabase/functions/gupshup-webhook/index.ts` | Webhook para callbacks do Gupshup |

### Modificar
| Arquivo | Mudança |
|---|---|
| `src/pages/IntegracaoPage.tsx` | Adicionar aba "WhatsApp" |
| `src/pages/AutomacaoPage.tsx` | Remover GupshupSettings, adicionar aviso redirecionando |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Adicionar suporte ao provedor Baylers |

## Detalhes Técnicos

### Campos no `tenant.settings` (jsonb)

```text
Gupshup (existentes):
  gupshup_api_key
  gupshup_app_name
  gupshup_source_number

Baylers (novos):
  baylers_api_key
  baylers_instance_url
  baylers_instance_name
  whatsapp_provider: "gupshup" | "baylers"  (indica qual está ativo)
```

### Webhook Gupshup

- Rota: `POST /functions/v1/gupshup-webhook`
- Sem JWT (verify_jwt = false)
- Recebe payload do Gupshup com status de entrega
- Atualiza `message_logs` com status atualizado

### API Baylers (Evolution API)

O envio de mensagem usa:
```text
POST {baylers_instance_url}/message/sendText/{instance_name}
Headers: apikey: {baylers_api_key}
Body: { number: "5511999999999", text: "mensagem" }
```

### Nenhuma migração SQL necessária

Todos os dados ficam no campo `settings` (jsonb) da tabela `tenants` que já existe.
