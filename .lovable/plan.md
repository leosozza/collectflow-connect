
# Melhoria da Documentação da API Rivo Connect

Objetivo: transformar a página `ApiDocs` (interna e pública) em uma referência técnica completa, alinhada ao contrato real do edge function `clients-api`, respondendo a todos os 10 blocos do questionário enviado pelo time da Y Brasil.

## Diagnóstico

A documentação atual (`src/pages/ApiDocsPage.tsx` e `ApiDocsPublicPage.tsx`) cobre apenas exemplos rápidos por endpoint. **Não responde** os pontos críticos cobrados pelo cliente:
- Não há seção de autenticação detalhada (rotação, sandbox, base URL única).
- Schemas de request/response não estão formalizados (pt-BR vs en, tipos, formatos).
- Códigos de erro não estão tabulados.
- Webhooks, idempotência, rate-limit e bulk-limits não aparecem.
- Não existe OpenAPI/Swagger nem Postman exportável.

## Escopo

### 1. Reescrita da `ApiDocsPage.tsx` com novas seções (em abas)

Substituir as abas atuais por uma estrutura que segue o questionário do cliente:

```text
[Início] [Auth] [Endpoints] [Schemas] [Webhooks] [Erros] [Limites] [Multi-credor] [Sandbox] [Downloads]
                                                                                    ↓
                                                                        OpenAPI / Postman / MCP
```

Conteúdo por aba:

- **Início**: visão geral, base URL única (`https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/clients-api`), ambientes (produção/sandbox compartilham URL — sandbox controlado pelo `tenant_id` da chave), versão (`v2.0.0`), changelog resumido.
- **Auth**: método (`X-API-Key` SHA-256 hash), header exato, prefixo `cf_`, como gerar/revogar (link para aba "API Keys"), escopo por credor (chave restrita a um credor força filtro automático em todas operações), CORS habilitado.
- **Endpoints**: lista completa extraída do código fonte (`clients-api/index.ts`):
  - `/health` (GET)
  - `/clients` (GET, POST), `/clients/bulk` (POST), `/clients/:id` (GET/PUT/DELETE), `/clients/by-external/:id` (PUT), `/clients/by-cpf/:cpf` (DELETE), `/clients/:id/status` (PUT)
  - `/agreements` (GET, POST), `/agreements/:id` (GET), `/agreements/:id/approve` (PUT), `/agreements/:id/reject` (PUT)
  - `/payments` (GET, POST), `/payments/methods` (GET), `/payments/:id` (GET), `/payments/pix` (POST), `/payments/cartao` (POST), `/payments/boleto` (POST)
  - `/portal/lookup` (POST), `/portal/agreement` (POST)
  - `/credores` (GET), `/status-types` (GET)
  - `/propensity/calculate` (POST)
  - Cada endpoint com: método, caminho, parâmetros, exemplo `curl` + JSON request + JSON response real + códigos HTTP possíveis.
- **Schemas**: tabela formal por entidade (Client, Agreement, Payment, Credor) com nome do campo, tipo, formato, obrigatório, descrição, valores aceitos. Inclui:
  - Aliases de mailing (`NOME_DEVEDOR` → `nome_completo`, etc.) — extrair do `normalizeRecord` do edge.
  - CPF/CNPJ: aceita com ou sem máscara.
  - Datas: `YYYY-MM-DD` (ISO) ou `DD/MM/YYYY` (auto-convertido).
  - Valores: decimal em reais (não centavos).
  - Status válidos: `pendente | pago | quebrado` (clients), `pending | approved | rejected` (agreements).
  - Tipos de pagamento: `pix | cartao | boleto` (+ meios customizados via `/payments/methods`).
- **Webhooks**: documentar o estado atual (ainda não exposto via `clients-api`) e a recomendação operacional — polling em `GET /payments/:id` até confirmar status. Sinalizar como "roadmap" se não houver hoje.
- **Erros**: tabela com todos os HTTP retornados pelo edge:
  - `400` body inválido, `401` X-API-Key inválida/ausente, `403` credor fora de escopo, `404` recurso inexistente, `422` validação (campos faltando/erros listados em `errors[]`), `500` erro interno.
  - Formato canônico: `{ "error": "...", "errors": [...] }`.
- **Limites**:
  - Bulk: máx **500 registros** por chamada `/clients/bulk` (extraído do código).
  - Paginação: `limit` máx 500 (clients) / 200 (agreements/payments), default 100/50.
  - Rate-limit: documentar política atual (Supabase Edge default) e indicar header `Retry-After` se aplicado.
- **Multi-credor**: como funciona escopo de chave, listar credores via `GET /credores`, qual valor usar em `credor` (string = `nome_fantasia` ou `razao_social`), regra de `enforceCredor` que sobrescreve.
- **Sandbox**: instruções para criar chave de teste (mesma URL, tenant separado), CPFs de teste sugeridos, como simular conclusão de pagamento (UPDATE manual no painel — admin).
- **Downloads**: 3 botões → OpenAPI 3.1 YAML, Coleção Postman v2.1, link MCP server (`supabase/functions/mcp-server`).

### 2. Geração de OpenAPI 3.1

Criar arquivo estático `public/api/openapi.yaml` cobrindo todos os endpoints, schemas e respostas. Endpoint público para baixar: `https://rivoconnect.com/api/openapi.yaml`. Botão "Download" e "Abrir no Swagger UI" (`https://editor.swagger.io/?url=...`).

### 3. Coleção Postman

Criar `public/api/rivo-connect.postman_collection.json` com variáveis `{{baseUrl}}` e `{{apiKey}}` e exemplos de cada endpoint.

### 4. Atualizar `ApiDocsPublicPage.tsx`

Refletir as mesmas seções (sem aba de gerenciamento de chaves nem logs de importação) — é a página linkável para devs externos.

### 5. Email pronto para o cliente

Bloco copiável dentro da aba "Início" com **resposta consolidada** ao questionário recebido, para que o usuário possa enviar diretamente ao time da Y Brasil sem reescrever.

## Arquivos a alterar / criar

- `src/pages/ApiDocsPage.tsx` — reestruturar abas e conteúdo.
- `src/pages/ApiDocsPublicPage.tsx` — espelhar conteúdo público.
- `src/components/api-docs/SchemaTable.tsx` (novo) — componente reutilizável para tabela de schemas.
- `src/components/api-docs/ErrorTable.tsx` (novo) — tabela de erros.
- `src/components/api-docs/EndpointReference.tsx` (novo) — card de endpoint com request/response/erros, evolução do `EndpointCard` atual.
- `public/api/openapi.yaml` (novo).
- `public/api/rivo-connect.postman_collection.json` (novo).
- `docs/API_REFERENCE.md` (novo) — markdown idêntico ao da página, para versionar.

## Detalhes técnicos

- Base URL exibida: `https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/clients-api` (já hardcoded em `BASE_URL`).
- Schemas extraídos diretamente de `clients-api/index.ts` (validators `validateClientRecord`, `buildClientRow`) para evitar drift.
- OpenAPI usará `securitySchemes.ApiKeyAuth` com `in: header, name: X-API-Key`.
- Respeitar tema RIVO (laranja primário) e padrão dos componentes shadcn já em uso.

## Fora de escopo

- Implementar webhooks de pagamento (apenas documentar estado atual / roadmap).
- Endpoints de cancelamento de cobrança (`POST /payments/:id/cancel`) — não existem hoje; serão marcados como "Em breve".
- Implementar idempotency-key real (será marcado como "use `external_id` ou `cod_contrato` como chave funcional de idempotência" — comportamento atual de upsert).
