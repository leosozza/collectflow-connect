

# Plano: Integração Asaas para Cobranças (CRM + Tokens)

## Visão Geral

Integrar o gateway de pagamentos Asaas para cobrar planos mensais e tokens dos tenants, com suporte a **Cartão de Crédito**, **PIX** e **Boleto**. Super Admin gerencia e acompanha todas as cobranças. Tenants pagam pela Central da Empresa > Financeiro.

---

## Fase 1: Secret da API Key do Asaas

Solicitar ao usuário a API Key do Asaas via ferramenta `add_secret` (nome: `ASAAS_API_KEY`). Também armazenar `ASAAS_ENVIRONMENT` (sandbox ou production).

---

## Fase 2: Tabela de Dados

**Migração SQL** — nova tabela `asaas_customers` e atualização de `payment_records`:

```text
asaas_customers
├── id (uuid PK)
├── tenant_id (FK tenants)
├── asaas_customer_id (text unique) — ID do cliente no Asaas
├── name, email, cpf_cnpj, phone
├── created_at, updated_at

payment_records (adicionar colunas)
├── asaas_payment_id (text) — ID da cobrança no Asaas
├── billing_type (text) — BOLETO, CREDIT_CARD, PIX
├── asaas_status (text) — PENDING, CONFIRMED, RECEIVED, etc.
├── pix_qr_code (text), pix_copy_paste (text)
├── boleto_url (text), invoice_url (text)
├── due_date (date)
```

RLS: tenant vê apenas seus registros; super_admin vê todos.

---

## Fase 3: Edge Function `asaas-proxy`

Uma edge function centralizada que faz proxy para a API Asaas:

**Endpoints internos:**
- `POST /customer` — Criar/buscar cliente no Asaas (usando CNPJ/CPF do tenant)
- `POST /payment` — Criar cobrança (plano mensal ou compra de tokens)
- `GET /payment/:id` — Consultar status
- `GET /payment/:id/pixQrCode` — Obter QR Code PIX
- `POST /payment/:id/tokenize` — Tokenizar cartão para cobranças recorrentes

**Lógica:** Recebe ação via body, valida auth, chama `https://api.asaas.com/v3/...` com header `access_token`, salva resultado em `payment_records`.

---

## Fase 4: Edge Function `asaas-webhook`

Recebe notificações do Asaas quando pagamento é confirmado:

- Atualiza `payment_records.asaas_status`
- Se `payment_type = 'token_purchase'` e status `CONFIRMED/RECEIVED` → chama RPC `add_tokens()`
- Se `payment_type = 'subscription'` e status `CONFIRMED` → atualiza status do tenant
- Cria notificação para o admin do tenant

Config: `verify_jwt = false` no config.toml (webhook externo).

---

## Fase 5: UI Tenant — Central da Empresa > Financeiro

Adicionar ao bloco existente da aba Financeiro em `TenantSettingsPage.tsx`:

**Novo Card "Pagamento"** abaixo do extrato, com:
- Botão "Pagar Mensalidade" (abre dialog)
- Lista de cobranças recentes (de `payment_records` com dados Asaas)

**Componente `src/components/financeiro/PaymentCheckoutDialog.tsx`:**
- Step 1: Resumo do valor (plano + serviços)
- Step 2: Escolha do método — 3 cards: Cartão, PIX, Boleto
- Step 3 (Cartão): Form de número, validade, CVV, nome, CPF → chama `asaas-proxy` com `billingType: CREDIT_CARD` + `creditCard` + `creditCardHolderInfo`
- Step 3 (PIX): Exibe QR Code + código copia-e-cola (retornado pela API)
- Step 3 (Boleto): Exibe link do boleto + botão copiar linha digitável

**Componente `src/components/financeiro/PaymentHistoryCard.tsx`:**
- Tabela: Data | Tipo | Valor | Método | Status (badge colorido)
- Status: Pendente (amarelo), Confirmado (verde), Vencido (vermelho)

---

## Fase 6: UI Super Admin — Gestão de Cobranças

**Atualizar `src/pages/admin/AdminFinanceiroPage.tsx`:**

Adicionar abaixo da tabela de faturamento existente:

**Card "Cobranças Asaas":**
- Filtros: status, método, período
- Tabela: Tenant | Valor | Tipo | Método | Status | Data | Ações
- Ações: Ver detalhes, Reenviar cobrança
- KPIs adicionais: Total Recebido (mês), Total Pendente, Inadimplência

**Card "Clientes Asaas":**
- Lista de tenants com seus IDs Asaas vinculados
- Botão para criar cliente Asaas manualmente

---

## Arquivos a Criar/Editar

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `asaas_customers`, alterar `payment_records` |
| `supabase/functions/asaas-proxy/index.ts` | Criar — proxy para API Asaas |
| `supabase/functions/asaas-webhook/index.ts` | Criar — webhook de confirmação |
| `supabase/config.toml` | Adicionar `verify_jwt = false` para webhook |
| `src/services/asaasService.ts` | Criar — chamadas ao proxy |
| `src/components/financeiro/PaymentCheckoutDialog.tsx` | Criar — dialog de pagamento 3 steps |
| `src/components/financeiro/PaymentHistoryCard.tsx` | Criar — histórico de cobranças |
| `src/pages/TenantSettingsPage.tsx` | Editar — adicionar cards de pagamento na aba Financeiro |
| `src/pages/admin/AdminFinanceiroPage.tsx` | Editar — adicionar gestão de cobranças Asaas |

---

## Ordem de Implementação

1. Secret `ASAAS_API_KEY` (precisa ser configurada primeiro)
2. Migração SQL (tabela + colunas)
3. Edge Functions (proxy + webhook)
4. Service TypeScript
5. UI Tenant (checkout + histórico)
6. UI Super Admin (gestão de cobranças)

