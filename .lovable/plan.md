# Expandir API de Pagamentos com Todos os Meios do Rivo

A API pública (`/clients-api`) hoje expõe apenas **PIX** e **Cartão**, mas o Rivo opera com mais meios reais via Asaas: **PIX, Cartão de Crédito, Boleto** (e meios configuráveis por credor em `meios_pagamento`). O plano alinha a API e a documentação com a realidade da plataforma.

## Meios de Pagamento Suportados

| Meio | Código API | Status atual |
|---|---|---|
| PIX | `pix` | ✅ já existe |
| Cartão de Crédito | `cartao` | ✅ já existe |
| Boleto Bancário | `boleto` | ❌ adicionar |
| Listar meios disponíveis | — | ❌ adicionar |

> Demais meios customizados (cadastrados em `meios_pagamento` por tenant/credor) serão expostos via novo endpoint de listagem, sem precisar de rota dedicada por meio.

## Mudanças na Edge Function `clients-api`

### 1. Novo endpoint: `GET /payments/methods`
Retorna todos os meios de pagamento disponíveis para o tenant (globais + por credor, opcional via `?credor_id=`).

```json
{
  "data": [
    { "code": "pix", "label": "PIX", "category": "instantaneo" },
    { "code": "cartao", "label": "Cartão de Crédito", "category": "cartao" },
    { "code": "boleto", "label": "Boleto Bancário", "category": "boleto" },
    { "code": "<uuid>", "label": "<custom>", "category": "custom", "credor_id": "..." }
  ]
}
```

### 2. Novo endpoint: `POST /payments/boleto`
Mesmo contrato dos endpoints existentes (`client_id`, `valor`, `data_vencimento`), grava em `negociarie_cobrancas` com `tipo = "boleto"`.

### 3. Endpoint genérico: `POST /payments`
Permite escolher o meio via campo `tipo` no body (`pix`, `cartao`, `boleto`), simplificando integrações futuras. Mantém os endpoints específicos por compatibilidade.

### 4. Filtro extra em `GET /payments`
Adicionar suporte ao query param `?tipo=pix|cartao|boleto` para filtrar por meio.

## Mudanças na Documentação (`ApiDocsPage.tsx` + `ApiDocsPublicPage.tsx`)

Atualizar a seção **"4. Pagamentos"** para listar:
- `GET  /payments` — Listar pagamentos (com filtros `status`, `client_id`, `tipo`)
- `GET  /payments/:id` — Status de um pagamento
- `GET  /payments/methods` — **NOVO** — Listar meios disponíveis
- `POST /payments` — **NOVO** — Gerar cobrança (meio definido via `tipo`)
- `POST /payments/pix` — Gerar cobrança PIX
- `POST /payments/cartao` — Gerar cobrança Cartão
- `POST /payments/boleto` — **NOVO** — Gerar cobrança Boleto

Atualizar exemplos cURL/Python/JS para incluir Boleto e o endpoint de listagem de meios.

## Arquivos Alterados

- `supabase/functions/clients-api/index.ts` — adicionar 3 rotas, ampliar filtro
- `src/pages/ApiDocsPage.tsx` — atualizar seção Pagamentos (admin/interno)
- `src/pages/ApiDocsPublicPage.tsx` — atualizar seção Pagamentos (público)

Sem migrations. Sem mudanças no schema. Compatível com integrações existentes (rotas antigas continuam funcionando).
