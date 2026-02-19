
# Documentacao Completa do Sistema - API REST

## Contexto
Atualmente, a documentacao (`/api-docs` e `/api-docs/public`) cobre apenas operacoes de clientes/mailing. O sistema possui muitas outras funcionalidades (acordos, pagamentos, portal, WhatsApp, propensity score, workflows) que nao estao expostas via API REST publica e nao estao documentadas.

## Objetivo
Expandir a API REST (`clients-api`) para cobrir todo o sistema e reescrever as paginas de documentacao com cobertura completa.

---

## Novos Endpoints a Implementar na Edge Function `clients-api`

### 1. Acordos (Agreements)
- **GET /agreements** - Listar acordos (filtros: status, cpf, credor)
- **GET /agreements/:id** - Buscar acordo por ID
- **POST /agreements** - Criar proposta de acordo
- **PUT /agreements/:id/approve** - Aprovar acordo
- **PUT /agreements/:id/reject** - Rejeitar acordo

### 2. Pagamentos (Payments)
- **GET /payments** - Listar pagamentos (filtros: agreement_id, status)
- **GET /payments/:id** - Status de um pagamento
- **POST /payments/pix** - Gerar cobranca PIX
- **POST /payments/cartao** - Gerar cobranca Cartao

### 3. Portal do Devedor
- **POST /portal/lookup** - Consultar dividas por CPF
- **POST /portal/agreement** - Criar proposta via portal

### 4. Status de Cobranca
- **GET /status-types** - Listar tipos de status cadastrados (retorna id + nome)
- **PUT /clients/:id/status** - Atualizar status de cobranca de um cliente

### 5. Credores
- **GET /credores** - Listar credores ativos

### 6. Propensity Score
- **POST /propensity/calculate** - Disparar calculo de propensao por CPF ou lote

### 7. WhatsApp
- **POST /whatsapp/send** - Enviar mensagem para um cliente
- **POST /whatsapp/bulk** - Envio em massa

### 8. Webhooks
- **POST /webhooks/configure** - Registrar URL de callback para notificacoes

---

## Reestruturacao das Paginas de Documentacao

### Pagina Interna (`/api-docs` - ApiDocsPage.tsx)
Reorganizar as tabs:

| Tab | Conteudo |
|-----|----------|
| API Keys | Gerenciamento de chaves (manter atual) |
| Clientes | Endpoints de CRUD de clientes + mailing |
| Acordos | Endpoints de acordos e negociacao |
| Pagamentos | Endpoints de cobrancas PIX/Cartao |
| Portal | Endpoints do portal do devedor |
| Cadastros | Status types, credores |
| Integracao | WhatsApp, propensity, webhooks |
| Importacoes | Monitoramento de mailings (manter atual) |

### Pagina Publica (`/api-docs/public` - ApiDocsPublicPage.tsx)
Reestruturar com secoes claras:

1. **Autenticacao** (manter)
2. **Clientes** - CRUD completo
3. **Acordos** - Criar, consultar, aprovar/rejeitar
4. **Pagamentos** - Gerar cobranças, verificar status
5. **Portal** - Consulta de dívidas, solicitação de acordo
6. **Cadastros** - Status de cobrança, credores
7. **WhatsApp** - Envio individual e em massa
8. **Webhooks** - Configuração de callbacks
9. **Campos aceitos** (expandir)
10. **Exemplos** - Python, Node.js, cURL para cada modulo
11. **Erros e Rate Limits**

---

## Detalhes Tecnicos

### Arquivo: `supabase/functions/clients-api/index.ts`
- Adicionar rotas para `agreements/*`, `payments/*`, `portal/*`, `status-types`, `credores`, `propensity/*`, `whatsapp/*`, `webhooks/*`
- Reutilizar logica existente dos services (agreementService, etc.) adaptada para Deno
- Manter autenticacao via X-API-Key com tenant isolation
- Para pagamentos, chamar internamente a Negociarie API (ja implementada no portal-checkout)

### Arquivo: `src/pages/ApiDocsPage.tsx`
- Reescrever com tabs expandidas cobrindo cada modulo
- Incluir exemplos de payload e resposta para cada endpoint
- Manter ImportLogsPanel na tab Importacoes

### Arquivo: `src/pages/ApiDocsPublicPage.tsx`
- Reescrever com secoes navegaveis para cada modulo
- Incluir exemplos completos em Python, Node.js e cURL
- Adicionar tabela de codigos de erro e rate limits

### Estimativa
- Edge function: ~400 linhas adicionais de rotas
- ApiDocsPage: reescrita completa (~900 linhas)
- ApiDocsPublicPage: reescrita completa (~700 linhas)
