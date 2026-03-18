
## Auditoria de Estabilidade para Produção — IMPLEMENTADO ✅

### Correções aplicadas

#### Fase 1 — Segurança Crítica ✅
1. **5 políticas RLS públicas removidas:** `tenants`, `agreements`, `portal_payments`, `agreement_signatures`, `invite_links`
2. **Funções SECURITY DEFINER criadas:** `lookup_tenant_by_slug`, `lookup_agreement_by_token`, `lookup_invite_by_token`
3. **Escalação de privilégio corrigida:** `tenant_users` (super_admin), `tenant_tokens` (INSERT/UPDATE), `operator_points` (self-write)
4. **payment_records** restrito a admins (INSERT/UPDATE/DELETE)

#### Fase 2 — Performance ✅
5. **5 índices compostos criados:** `clients(tenant_id,status)`, `clients(tenant_id,cpf)`, `clients(tenant_id,credor)`, `agreements(tenant_id,status)`, `agreements(checkout_token)` parcial

#### Pendente (ação manual)
- **Leaked Password Protection** — habilitar manualmente no backend
- **credores/whatsapp_instances** — criar views sem campos sensíveis para operadores (warning, não crítico)
