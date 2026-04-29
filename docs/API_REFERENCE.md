# Rivo Connect API — Referência Técnica (v2.0.0)

**Base URL (produção e sandbox — isolamento por tenant):**
`https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/clients-api`

**Autenticação:** header `X-API-Key: cf_xxxxxxxx`
**Documentação interativa:** https://rivoconnect.com/api-docs/public
**OpenAPI 3.1:** https://rivoconnect.com/api/openapi.yaml
**Postman:** https://rivoconnect.com/api/rivo-connect.postman_collection.json

---

## 1. Autenticação

| Item | Valor |
|---|---|
| Método | API Key (SHA-256) |
| Header | `X-API-Key: cf_...` |
| Prefixo | `cf_` |
| Escopo | Tenant inteiro **ou** restrita a 1 credor |
| Rotação | Manual (revogar + gerar nova no painel) |
| Sandbox | Mesma URL, tenant separado sob solicitação |
| CORS | Habilitado (`*`) |

## 2. Endpoints (resumo)

### Clients
- `GET /clients` — paginado (limit max 500). Filtros: `cpf`, `credor`, `status`.
- `GET /clients/{id}`
- `POST /clients` — upsert por `(external_id, tenant_id)` ou `(cpf, numero_parcela, tenant_id)`.
- `POST /clients/bulk` — até **500** por chamada. Parcial (não atômico).
- `PUT /clients/{id}` · `PUT /clients/by-external/{id}` · `PUT /clients/{id}/status`
- `DELETE /clients/{id}` · `DELETE /clients/by-cpf/{cpf}`

### Agreements
- `GET /agreements` (limit max 200)
- `GET /agreements/{id}` · `POST /agreements`
- `PUT /agreements/{id}/approve` · `PUT /agreements/{id}/reject`

### Payments
- `GET /payments` · `GET /payments/{id}` · `GET /payments/methods`
- `POST /payments` (campo `tipo: pix|cartao|boleto`)
- `POST /payments/pix` · `POST /payments/cartao` · `POST /payments/boleto`

### Portal
- `POST /portal/lookup` (busca dívidas por CPF)
- `POST /portal/agreement`

### Cadastros
- `GET /credores` — lista credores. Quando a `X-API-Key` é restrita a 1 credor, retorna **somente** esse credor com **todos os campos públicos** (cadastro, endereço, contato, dados bancários, gateway, regras de negociação, templates, configurações de portal e assinatura). Chaves globais retornam todos os credores `ativos` com os mesmos campos. Campos sensíveis (`gateway_token`) **nunca** são expostos.
- `GET /credores/{id}` — detalhe completo de um credor. Em chaves restritas, só permite o `id` do próprio escopo (caso contrário, **403**).
- `GET /status-types`

### Webhooks
- `GET /webhooks` · `POST /webhooks/configure`

### Outros
- `POST /whatsapp/send` · `POST /whatsapp/bulk` (max 200)
- `POST /propensity/calculate`

## 3. Schemas (campos)

### Client
| Campo | Tipo | Obrig. | Notas |
|---|---|---|---|
| `credor` | string | sim | use `nome_fantasia` de `GET /credores` |
| `nome_completo` | string ≥2 | sim | aliases: `NOME_DEVEDOR` |
| `cpf` | string | sim | CPF/CNPJ com ou sem máscara |
| `external_id` | string | não | chave de idempotência |
| `cod_contrato` | string | não | indexado |
| `phone`/`phone2`/`phone3` | string | não | E.164 ou nacional |
| `email` | email | não | |
| `valor_parcela` | decimal (reais) | sim | NÃO usar centavos |
| `data_vencimento` | `YYYY-MM-DD` ou `DD/MM/YYYY` | sim | auto-convertida |
| `numero_parcela`/`total_parcelas` | int | não | default 1 |
| `status` | enum | não | `pendente`\|`pago`\|`quebrado` |

### Agreement
`client_cpf`, `client_name`, `credor`, `original_total`, `proposed_total`, `new_installments`, `new_installment_value`, `first_due_date` — todos obrigatórios.

### Payment
`client_id` (UUID), `valor` (decimal reais), `data_vencimento` (ISO), `tipo` (`pix|cartao|boleto`).

## 4. Webhooks

```json
POST /webhooks/configure
{ "url": "https://seu-sistema.com/rivo-webhook",
  "events": ["agreement.approved","payment.confirmed","client.updated"] }
```

Eventos: `agreement.approved`, `agreement.rejected`, `payment.confirmed`, `payment.expired`, `client.updated`.
Retry: 3 tentativas (30s / 2min / 10min). Validação HMAC: roadmap.

## 5. Idempotência

- Chave funcional: `external_id` por tenant.
- Reenvio mesmo `external_id` → upsert silencioso (não duplica, não retorna 409).
- `/clients/bulk` é parcial — válidos entram, inválidos retornam em `errors[]`.

## 6. Limites

| Recurso | Limite |
|---|---|
| Bulk clients | 500/chamada |
| Bulk WhatsApp | 200/chamada |
| `GET /clients?limit=` | 500 (default 100) |
| `GET /agreements`, `/payments` | 200 (default 50) |
| Payload | ~6 MB |

## 7. Erros

| HTTP | Código | Descrição |
|---|---|---|
| 401 | UNAUTHORIZED | X-API-Key inválida/ausente |
| 403 | FORBIDDEN_CREDOR | Credor fora do escopo da chave |
| 404 | NOT_FOUND | Recurso inexistente |
| 422 | VALIDATION_FAILED | `errors[]` lista os problemas |
| 422 | BULK_LIMIT | >500 registros em bulk |
| 500 | INTERNAL_ERROR | Erro interno |

Formato canônico: `{ "error": "...", "errors": [...] }`.

## 8. Multi-credor

Liste credores com `GET /credores`. Use `nome_fantasia` no campo `credor` dos payloads. Chave restrita a um credor força automaticamente o filtro em todas as operações.

## 9. Sandbox

- Solicite tenant de teste com chave dedicada.
- CPFs sugeridos: `111.111.111-11` (sucesso) / `000.000.000-00` (falha).
- Simular pagamento: confirmar manualmente no painel admin.

## 10. Recursos

- **OpenAPI 3.1 YAML:** `/api/openapi.yaml`
- **Postman:** `/api/rivo-connect.postman_collection.json`
- **MCP Server:** `https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/mcp-server`
