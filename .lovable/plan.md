
# Sistema Completo de API REST para Gerenciamento de Clientes (Leads)

## Visão Geral

Criar uma Edge Function dedicada `clients-api` que expõe uma API REST pública (autenticada via API Key) para que sistemas externos possam enviar, atualizar e deletar clientes em massa — com suporte a 10.000+ registros via importação em lote com paginação, validação completa e documentação inline.

Junto com isso, criar uma página de documentação da API acessível dentro do sistema (`/api-docs`) onde o admin pode visualizar os endpoints, gerar e revogar a API Key do tenant.

---

## Arquitetura

```text
Sistema Externo (10k+ clientes)
         |
         | POST /functions/v1/clients-api (com X-API-Key: <chave>)
         v
  Edge Function: clients-api
         |
         |-- Autentica via api_keys (tenant_id isolado)
         |-- Valida payload com Zod
         |-- Processa em batches de 500
         |-- Upsert/Delete no banco (service_role)
         v
  Tabela: clients (com tenant_id)
```

---

## 1. Nova Tabela: `api_keys`

Armazena as API Keys geradas por tenant para autenticação externa.

```sql
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,        -- SHA-256 do token real
  key_prefix TEXT NOT NULL,             -- Primeiros 8 chars para identificação visual
  label TEXT NOT NULL DEFAULT 'Chave Padrão',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Somente admins do tenant gerenciam suas chaves
CREATE POLICY "Tenant admins can manage api_keys"
  ON public.api_keys FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));
```

**Segurança:** O token real (gerado com `crypto.randomUUID()`) é exibido SOMENTE uma vez ao criar a chave. O banco armazena apenas o hash SHA-256 — nunca o token em texto plano.

---

## 2. Edge Function: `clients-api`

Arquivo: `supabase/functions/clients-api/index.ts`

### Endpoints

| Método | Path | Descrição |
|---|---|---|
| `POST` | `/functions/v1/clients-api/clients` | Criar ou upsert de 1 cliente |
| `POST` | `/functions/v1/clients-api/clients/bulk` | Inserção em massa (até 500 por chamada) |
| `PUT` | `/functions/v1/clients-api/clients/:id` | Atualizar cliente por ID |
| `PUT` | `/functions/v1/clients-api/clients/by-external/:external_id` | Atualizar por external_id |
| `DELETE` | `/functions/v1/clients-api/clients/:id` | Deletar cliente por ID |
| `DELETE` | `/functions/v1/clients-api/clients/by-cpf/:cpf` | Deletar todos os registros de um CPF |
| `GET` | `/functions/v1/clients-api/clients` | Listar clientes (paginado) |
| `GET` | `/functions/v1/clients-api/clients/:id` | Buscar cliente por ID |
| `GET` | `/functions/v1/clients-api/health` | Status da API |

### Autenticação

Todas as requisições devem incluir o header:
```
X-API-Key: cf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

A edge function:
1. Extrai o header `X-API-Key`
2. Calcula SHA-256 do valor recebido
3. Busca na tabela `api_keys` onde `key_hash = hash AND is_active = true`
4. Obtém o `tenant_id` vinculado — todas as operações ficam isoladas ao tenant

### Formato do Payload — Upsert Único

```json
{
  "credor": "EMPRESA XYZ",
  "nome_completo": "João da Silva",
  "cpf": "123.456.789-00",
  "phone": "11999999999",
  "email": "joao@email.com",
  "external_id": "EXT-001",
  "endereco": "Rua das Flores, 123",
  "cidade": "São Paulo",
  "uf": "SP",
  "cep": "01310-100",
  "observacoes": "Cliente VIP",
  "numero_parcela": 1,
  "total_parcelas": 3,
  "valor_entrada": 500.00,
  "valor_parcela": 300.00,
  "valor_pago": 0,
  "data_vencimento": "2026-03-01",
  "status": "pendente"
}
```

### Formato do Payload — Bulk (até 500 registros)

```json
{
  "records": [ {...}, {...}, ... ],
  "upsert": true,
  "upsert_key": "external_id"
}
```

**Chave de upsert:** `external_id` (padrão) ou `cpf + numero_parcela`.

### Resposta Padrão

```json
{
  "success": true,
  "inserted": 450,
  "updated": 30,
  "skipped": 20,
  "errors": [
    { "index": 5, "external_id": "EXT-005", "error": "CPF inválido" }
  ],
  "total": 500
}
```

### Processamento de 10.000+ Registros

O sistema externo deve paginar as chamadas:
- Máximo 500 registros por requisição `POST /bulk`
- Recomendação: 20 chamadas de 500 = 10.000 clientes
- Suporte a `upsert: true` para reenvio sem duplicatas (idempotente)

---

## 3. Página de Documentação: `/api-docs` (somente admin)

Nova página `src/pages/ApiDocsPage.tsx` com:

### Seção 1: Gerenciamento de API Keys
- Botão "Gerar Nova Chave" → exibe modal com o token (exibido UMA VEZ)
- Lista de chaves ativas com prefixo e data de criação
- Botão "Revogar" por chave
- Badge de status: Ativa / Revogada

### Seção 2: Documentação dos Endpoints (formato Swagger-like)
- URL base do sistema
- Descrição de cada endpoint com exemplos de request/response em blocos de código
- Seção especial "Importação em Massa" com exemplo de loop de 10k registros
- Tabela de campos aceitos com tipo, obrigatoriedade e descrição

### Seção 3: Exemplos de Código
Snippets prontos para copiar em:
- **Python** (requests)
- **Node.js / JavaScript** (fetch)
- **cURL**

---

## 4. Rota e Navegação

Adicionar rota `/api-docs` em `App.tsx` (somente admin).
Adicionar item no menu de navegação dentro de `AppLayout.tsx` (visível somente para admins).

---

## 5. Arquivos a Criar/Modificar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/..._api_keys.sql` | Nova tabela `api_keys` com RLS |
| `supabase/functions/clients-api/index.ts` | **Nova** Edge Function REST completa |
| `supabase/config.toml` | Adicionar `[functions.clients-api] verify_jwt = false` |
| `src/pages/ApiDocsPage.tsx` | **Nova** página de documentação e gerenciamento de chaves |
| `src/services/apiKeyService.ts` | **Novo** service para CRUD de api_keys |
| `src/App.tsx` | Adicionar rota `/api-docs` |
| `src/components/AppLayout.tsx` | Link no menu (somente admin) |

---

## 6. Segurança

- API Keys nunca armazenadas em texto plano (somente hash SHA-256)
- Todas as operações da edge function são isoladas por `tenant_id`
- Rate limiting implícito pelo tamanho dos lotes (500/req)
- Logs de uso em `last_used_at` da chave
- Revogação instantânea ao marcar `is_active = false`
- Validação Zod em todos os campos antes de qualquer operação no banco
