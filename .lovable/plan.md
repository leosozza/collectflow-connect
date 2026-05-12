## Revisão da integração Negociarie — bugs encontrados e correções

Após uma varredura completa do código (proxy, callback, credentials, migrations, RLS e UI), encontrei **6 problemas reais** que afetam Y.BRASIL e/ou impedem que outros tenants usem a integração. Abaixo cada um, o impacto e a correção.

---

### 🔴 1. Bug crítico no `catch` do `negociarie-proxy` (quebra logging e invalida cache errada)

**Arquivo:** `supabase/functions/negociarie-proxy/index.ts` (linhas 430–466)

O bloco `catch` referencia variáveis declaradas **dentro** do `try` (`userData`, `userId`, `tenantId`, `action`, `params`). Em qualquer erro lançado **antes** dessas linhas (ex.: erro de auth ou de parsing do JSON), o `catch` dispara `ReferenceError` e a Edge Function retorna 500 sem corpo útil — e o `audit_logs` nunca é gravado.

Além disso, na linha 459 usa a chave de cache `token_${tenantId}` (sem `_default`), enquanto `getToken` salva como `token_${tenantId}_${creditorId || "default"}`. **A invalidação em 401 nunca limpa o token real.** Token expirado fica em cache até reinício do isolate — Y.BRASIL pode ficar 1h batendo "Falha ao autenticar".

**Correção:** declarar `let userId, tenantId, action, params, userData` antes do `try`, e usar a mesma fórmula de chave de cache (`token_${tenantId}_${creditorId || "default"}`) na invalidação.

---

### 🔴 2. Proxy lê `tenant_integrations` com cliente anon → outros tenants nunca conseguirão usar

**Arquivo:** `negociarie-proxy/index.ts` linhas 159–163, 25–55

O proxy cria o `supabase` client com `SUPABASE_ANON_KEY` + JWT do usuário e lê `tenant_integrations`. Mas a nova RLS aplicada na migração de hoje é `no_direct_select USING (false)` — **nenhum SELECT via JWT retorna linhas**.

Resultado: para qualquer tenant que NÃO seja Y.BRASIL, `tenantIntegration` vem `null`, cai no fallback ENV (que só tem credenciais Y.BRASIL) e qualquer chamada da Negociarie retorna erro de autenticação. Y.BRASIL "funciona" por puro acidente — sempre vai pro ENV.

**Correção:** `getNegociarieConfig` precisa usar um client **service_role** dedicado (`SUPABASE_SERVICE_ROLE_KEY`) só para ler a tabela de credenciais. O JWT do usuário continua usado apenas para validar a identidade e descobrir o `tenant_id`.

---

### 🟠 3. Tabela `tenant_integrations` já existia — schema antigo sobreviveu

**Arquivos:** `supabase/migrations/20260506154500_tenant_integrations_v1.sql` + `20260506163500_creditor_integrations.sql` vs. `20260512141015_*.sql`

A nova migração usa `create table if not exists`, mas a tabela antiga (de 06/05) já existia com colunas diferentes. Provavelmente faltam: `environment`, `last_test_at`, `last_test_ok`, `last_test_message`, `callback_registered_at`. A RPC `get_my_integrations_status` referencia essas colunas — se alguma estiver ausente, **a função quebra com `column does not exist`** e a UI nunca carrega o status.

Além disso, **as policies RLS antigas continuam ativas em paralelo** com a nova `no_direct_select`. Como permissive policies são OR, a "deny-all" é fictícia — qualquer usuário do tenant continua lendo `client_secret` em texto puro via SQL bruto.

**Correção:** migration de saneamento que (a) faz `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para todas as colunas novas, (b) `DROP POLICY` nas políticas antigas (`Tenant users can view own integrations`, `Tenant admins can manage own integrations`, `Tenant admins can manage creditor integrations`), mantendo só as novas (`no_direct_select`, `tenant_admin_insert/update/delete`), (c) confirma o seed da Y.BRASIL.

⚠️ **Atenção:** os componentes admin (`src/components/admin/integrations/CreditorIntegrationsVault.tsx` e `TenantIntegrationsVault.tsx`) leem `tenant_integrations` direto — após o fechamento do RLS eles param de funcionar. Vou trocar essas leituras pela RPC `get_my_integrations_status` (ou criar um RPC equivalente para super admin via `can_access_tenant`).

---

### 🟠 4. `negociarie-callback` valida token só com credenciais globais (Y.BRASIL)

**Arquivo:** `negociarie-callback/index.ts` linhas 128–139

O HMAC do webhook é calculado como `sha1(NEGOCIARIE_CLIENT_ID + NEGOCIARIE_CLIENT_SECRET)` lendo do ENV. Se outro tenant configurar credenciais próprias, o callback dele **sempre** retornará 401 (token nunca bate). E como o ENV é só Y.BRASIL, qualquer outro tenant que ative a integração terá baixas perdidas.

**Correção:** descobrir o tenant através do `id_parcela` da primeira parcela do payload → `negociarie_cobrancas` → `tenant_id` → `tenant_integrations` (via service_role). Recalcular o `expected = sha1(client_id + client_secret)` com as credenciais corretas. Se a linha for `uses_global_fallback`, usar o ENV como hoje (Y.BRASIL preservado).

---

### 🟡 5. Credor com `cobrança_direta_ativa = true` sem linha em `tenant_integrations`

**Arquivo:** `negociarie-proxy/index.ts` linhas 16–44

Hoje, se o credor está marcado como "cobrança direta" mas o tenant ainda não cadastrou as credenciais específicas dele, o proxy faz fallback silencioso para as credenciais do tenant. Isso pode emitir boletos pelo CNPJ errado e gerar conciliação confusa.

**Correção:** quando `cobrança_direta_ativa = true` E não houver linha no `tenant_integrations`, **bloquear** com erro claro (`Cobrança direta ativa para este credor mas credenciais Negociarie não cadastradas`). Y.BRASIL continua intocada porque os credores dela não usam essa flag.

---

### 🟡 6. UI `NegociarieTab` mostra "Não configurado" para Y.BRASIL caso o seed falhe

**Arquivo:** `src/components/integracao/NegociarieTab.tsx` + `src/pages/IntegracaoPage.tsx`

Se a row de seed da migração 20260512 não tiver sido inserida (ex.: tabela ainda não existia no momento certo, conflito com ON CONFLICT), Y.BRASIL aparece como "Não configurado". A funcionalidade roda (cai no ENV) mas o admin se assusta.

**Correção:** após o saneamento da migração (item 3) confirmar via RPC que a row existe; se não existir, re-inserir como parte da migration. UI exibe badge "Conectado (cofre global)" quando `uses_global_fallback = true`.

---

## Plano de execução (em ordem)

1. **Migration de saneamento** (`tenant_integrations` schema + RLS + seed Y.BRASIL):
   - `ADD COLUMN IF NOT EXISTS` para `environment`, `last_test_at`, `last_test_ok`, `last_test_message`, `callback_registered_at`
   - `DROP POLICY` nas três políticas antigas
   - Recriar `no_direct_select` + `tenant_admin_*` (idempotente)
   - Recriar/validar RPC `get_my_integrations_status`
   - `INSERT ... ON CONFLICT DO NOTHING` da row Y.BRASIL com `uses_global_fallback: true`

2. **`negociarie-proxy/index.ts`**:
   - Mover `let` de `userId/tenantId/action/params/userData` para fora do `try`
   - Criar `adminClient` com SERVICE_ROLE para `getNegociarieConfig`
   - Corrigir chave de invalidação de cache no catch
   - Erro explícito quando credor `cobrança_direta_ativa` não tem credenciais cadastradas

3. **`negociarie-callback/index.ts`**:
   - Lookup de credenciais por tenant a partir do `id_parcela`
   - Manter Y.BRASIL via fallback ENV quando `uses_global_fallback = true`

4. **Admin vaults (`CreditorIntegrationsVault`, `TenantIntegrationsVault`)**:
   - Trocar leitura direta de `tenant_integrations` por RPC mascarada

5. **Smoke test** após deploy:
   - `test-connection` Y.BRASIL → deve retornar `connected: true`
   - `consulta-cobrancas` com CPF real → deve listar parcelas
   - Simular callback de baixa via `curl` → conferir `negociarie_cobrancas.status='pago'` + `client_events` + `agreement_completed`

Nada do fluxo Y.BRASIL é removido: o ENV continua sendo a fonte real de credenciais e o cache por tenant é mantido. A diferença é que agora outros tenants conseguem ativar a integração com suas próprias chaves sem colidir.
