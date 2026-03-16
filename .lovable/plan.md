

# Auditoria de Estabilidade para Produção — Resultados e Plano de Correção

## Resumo Executivo

Executei verificações automáticas em 5 frentes: segurança/RLS, performance de queries, edge functions, integridade de dados e linter do banco. Seguem os achados organizados por criticidade.

---

## 1. VULNERABILIDADES DE SEGURANÇA (5 CRÍTICAS + 4 WARNINGS)

### Críticas (devem ser corrigidas ANTES de ir para produção)

| # | Problema | Risco |
|---|---------|-------|
| 1 | **Tabela `tenants` com política SELECT pública** (`USING: true`) — expõe `settings` JSONB com tokens de API (cobcloud_token, etc.) | Vazamento de credenciais para qualquer pessoa na internet |
| 2 | **Tabela `agreements` com política SELECT pública** (`checkout_token IS NOT NULL`) — expõe CPF, nome, valores financeiros de TODOS os acordos com checkout token | Vazamento massivo de dados pessoais (LGPD) |
| 3 | **Tabela `portal_payments` com mesma falha** — expõe valores, método de pagamento, status | Dados financeiros expostos |
| 4 | **Tabela `agreement_signatures` com mesma falha** — expõe IP, user_agent, assinatura digital | Dados sensíveis expostos |
| 5 | **Tabela `invite_links` com política SELECT pública** — permite enumerar TODOS os tokens de convite ativos | Criação não-autorizada de contas |

### Warnings (corrigir antes ou logo após go-live)

| # | Problema |
|---|---------|
| 6 | `credores` — operadores têm acesso a `gateway_token`, dados bancários |
| 7 | `whatsapp_instances` — operadores veem `api_key` |
| 8 | `payment_records` — qualquer usuário do tenant pode INSERT/UPDATE/DELETE pagamentos |
| 9 | `operator_points` — operadores podem alterar seus próprios pontos/métricas |
| 10 | Leaked Password Protection desabilitado |

### Correções planejadas

Para cada tabela crítica, substituir a política pública por uma **função SECURITY DEFINER** que valida o token antes de retornar dados:

```sql
-- Exemplo para agreements:
CREATE OR REPLACE FUNCTION public.lookup_agreement_by_token(_token text)
RETURNS SETOF agreements
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM agreements WHERE checkout_token = _token LIMIT 1;
$$;

-- Remover a política pública perigosa
DROP POLICY "Public can view agreement by checkout token" ON agreements;
```

Mesma abordagem para `portal_payments`, `agreement_signatures`, `invite_links`.

Para `tenants`: criar uma VIEW pública com apenas campos seguros (name, slug, logo_url, primary_color) e remover a política de SELECT irrestrita.

---

## 2. PERFORMANCE — QUERIES LENTAS

### Achado principal: tabela `clients` (9.495 registros)

| Métrica | Valor |
|---------|-------|
| Sequential scans | 939 |
| Rows lidas por seq scan | 8.4 milhões |
| Index scans | **0** |

**Diagnóstico:** Os índices existentes (`tenant_id`, `external_id+tenant_id`, `propensity_score`, `cod_contrato`) não estão sendo usados. Faltam índices compostos para as queries mais comuns (filtros por `tenant_id + status`, `tenant_id + cpf`, `tenant_id + credor`).

### Correção: criar índices compostos

```sql
CREATE INDEX idx_clients_tenant_status ON clients(tenant_id, status);
CREATE INDEX idx_clients_tenant_cpf ON clients(tenant_id, cpf);
CREATE INDEX idx_clients_tenant_credor ON clients(tenant_id, credor);
```

### Outros: 30+ índices nunca utilizados (0 scans)
Muitas tabelas têm índices criados que nunca foram consultados. Não é urgente remover, mas pode ser feito no futuro para reduzir overhead de escrita.

---

## 3. EDGE FUNCTIONS

- **Nenhum erro HTTP 4xx/5xx** nos logs recentes
- **Nenhuma função com execução > 3s**
- Status: **Saudável**

---

## 4. INTEGRIDADE DE DADOS

- **Nenhum erro de banco** (ERROR/FATAL/PANIC) nos logs do PostgreSQL
- **Dead tuples:** 0 em todas as tabelas (vacuum funcionando bem)
- **Duplicação:** sem evidência de dados duplicados
- Status: **Saudável**

---

## 5. LINTER DO BANCO

| Nível | Achado |
|-------|--------|
| WARN | Extensão instalada no schema `public` (recomendado mover para schema dedicado) |
| WARN | Leaked Password Protection desabilitado |

---

## Plano de Implementação (Priorizado)

### Fase 1 — Obrigatório antes de Go-Live
1. **Corrigir 5 políticas RLS críticas** (dados expostos publicamente)
2. **Criar índices de performance** na tabela `clients`
3. **Ativar Leaked Password Protection**

### Fase 2 — Recomendado na primeira semana
4. Restringir `credores` e `whatsapp_instances` para admins (campos sensíveis)
5. Restringir `payment_records` para admins (INSERT/UPDATE/DELETE)
6. Restringir `operator_points` para service_role apenas

### Arquivos a serem alterados
- 1 migration SQL (políticas RLS + índices + funções SECURITY DEFINER)
- `src/services/agreementService.ts` — usar RPC ao invés de query direta para portal
- `src/components/portal/*` — ajustar chamadas de lookup
- Auth config — habilitar leaked password protection

