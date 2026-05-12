## Migrar componentes admin para a edge function segura

Os dois componentes admin (`TenantIntegrationsVault` em `SuperAdminPage` e `CreditorIntegrationsVault` em `CredorForm`) ainda fazem `SELECT`/`UPSERT` direto na tabela `tenant_integrations`. Como a RLS agora é `no_direct_select USING(false)` e o INSERT/UPDATE exige `tenant_id = get_my_tenant_id()`, esses dois componentes estão **quebrados**:

- A leitura sempre retorna vazio (toda integração aparece como "Não configurado").
- O super admin não consegue salvar credenciais para outros tenants (RLS bloqueia porque o `tenant_id` alvo ≠ `get_my_tenant_id()` do super admin).

### Solução

Centralizar toda leitura/escrita pela edge function `negociarie-credentials` (que já roda em service-role e valida o solicitante). Acrescentamos 1 ação nova e ampliamos as existentes para aceitar `tenant_id` quando o chamador for super admin.

---

### 1. Estender `supabase/functions/negociarie-credentials/index.ts`

- **Nova action `get_status`**: retorna o mesmo formato mascarado da RPC `get_my_integrations_status` (sem `client_secret`), filtrado por `tenant_id` + `creditor_id` opcionais.
- **Permissão "ator"**:
  - Se `payload.tenant_id` está ausente OU é igual ao tenant do chamador → exige `profiles.role = 'admin'` (comportamento atual).
  - Se `payload.tenant_id` é **diferente** do tenant do chamador → exige `public.can_access_tenant(payload.tenant_id)` retornar `true` (super admin support mode, padrão já adotado em outras RPCs do projeto).
- Aplicar a mesma checagem de "ator" em `save`, `test` e `delete`, usando `targetTenantId = payload.tenant_id ?? callerTenantId`.

### 2. Refatorar `src/components/admin/integrations/TenantIntegrationsVault.tsx`

- Trocar o `select` direto por `supabase.functions.invoke('negociarie-credentials', { body: { action: 'get_status', tenant_id } })`.
- Trocar o `upsert` direto por `action: 'save'` com `tenant_id` no body. Isso valida na Negociarie antes de gravar — comportamento idêntico ao `NegociarieTab` da própria tenant.
- Estado local exibe `client_id_masked`, `last_test_ok`, `callback_registered_at`, `uses_global_fallback`. Campo `client_secret` fica como input vazio (envia só ao salvar, mantém o anterior se vazio — lógica que `negociarie-credentials` já implementa).

### 3. Refatorar `src/components/admin/integrations/CreditorIntegrationsVault.tsx`

- Mesmo padrão do item 2, com `creditor_id` no body de todas as ações.
- Mostrar badge "Cofre Ativo" baseada em `has_credentials` retornado pela função.

### 4. Smoke test pós-deploy

- Como super admin, abrir `SuperAdminPage` → gerenciar uma tenant qualquer → ver status carregado e salvar credenciais fictícias (deve falhar no login da Negociarie como esperado).
- Como admin do tenant Y.BRASIL, abrir `CredorForm` em um credor sem cobrança direta — deve aparecer "Não configurado" sem quebrar.
- Conferir que o `NegociarieTab` em Configurações → Integrações **continua** funcionando (não tocamos nele).

---

### Fora do escopo desta rodada
- Migrar Asaas/CobCloud para o mesmo cofre — feito quando outro tenant pedir.
- HMAC validation extra no webhook — já corrigido na rodada anterior.
- Remover documentação antiga referente ao acesso direto da tabela.

Resultado esperado: super admin volta a gerenciar credenciais Negociarie de qualquer tenant; o admin do tenant edita só as suas; Y.BRASIL operacional segue intocada porque continua usando `uses_global_fallback`.
