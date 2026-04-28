## Análise da arquitetura atual

**Sim, o Super Admin já está em lógica separada dos tenants:**
- Layout próprio: `SuperAdminLayout` com rotas `/admin/*` (acesso só para `isSuperAdmin`).
- Páginas próprias em `src/pages/admin/*` (não compartilham com o painel do tenant).
- Permissões via `useSAPermissions` (RPC `get_my_sa_permissions`).

**Estado atual da integração Asaas:**
- Existe **um único** edge function `asaas-proxy` que usa as secrets globais `ASAAS_API_KEY_SANDBOX` / `ASAAS_API_KEY_PRODUCTION` definidas no painel + `system_settings.asaas_environment`.
- Hoje essa mesma chave é usada tanto para cobranças da plataforma (cobrar tenants) quanto, potencialmente, por outras integrações.
- Os tenants já possuem suas próprias integrações de boleto independentes (CobCloud, Negociarie, etc.) — essas **não usam** Asaas, então não há conflito direto. O risco é apenas que, no futuro, um tenant queira ter sua própria conta Asaas — precisamos garantir isolamento desde já.

## O que vamos fazer

### 1. Criar conceito "Conta Asaas da Plataforma" (separada de tenants)

Nova tabela `platform_billing_accounts` (escopo super admin, sem `tenant_id`):
- `id`, `provider` ('asaas'), `environment` ('sandbox'|'production'), `account_label`, `wallet_id` (subconta/destino dos repasses), `webhook_token`, `last_test_at`, `last_test_status`, `is_active`.
- Secrets (API key sandbox/produção) continuam em `Deno.env` da edge function (`ASAAS_PLATFORM_API_KEY_SANDBOX` / `ASAAS_PLATFORM_API_KEY_PRODUCTION`) — **novas** secrets, separadas das atuais, para garantir isolamento.
- RLS: SELECT/INSERT/UPDATE somente para `is_super_admin(auth.uid())`.

Por que separar do `system_settings.asaas_environment` atual: hoje qualquer mudança no ambiente afeta tudo. Com a tabela dedicada conseguimos, no futuro, suportar conta Asaas por tenant sem quebrar a plataforma.

### 2. Edge function dedicada `asaas-platform-proxy`

- Cópia funcional do `asaas-proxy` mas:
  - Lê config de `platform_billing_accounts` (não de `system_settings`).
  - Usa secrets `ASAAS_PLATFORM_API_KEY_*` (separadas).
  - Exige super admin no JWT.
  - Suporta ações: `create_customer`, `create_payment`, `get_payment`, `get_pix_qrcode`, `tokenize_card` (para cobrança dos tenants).
- O `asaas-proxy` atual fica intacto para qualquer fluxo de tenant existente.

### 3. Mover "Integrações" para dentro de Configurações no Super Admin

Atualmente:
- Sidebar tem **"Integrações"** (`/admin/configuracoes` → `AdminConfiguracoesPage`) como um item de "Automação e Serviços".
- Não existe um item "Configurações" do super admin com sub-abas.

Mudanças:
- Renomear item da sidebar para **"Configurações"** (ícone Cog, path `/admin/configuracoes`).
- Reestruturar `AdminConfiguracoesPage` em **abas de nível superior**:
  - **Geral** (segurança/notificações/sistema que já estão lá)
  - **Integrações** (sub-tabs: Asaas Plataforma, Target Data, Negociarie, CobCloud, 3CPlus, WhatsApp, Negativação) — todas as tabs atuais movidas para cá.
  - A sub-aba **Asaas Plataforma** (nova) gerencia `platform_billing_accounts`: ambiente, label, wallet_id, status da última conexão, botão "Testar Conexão" (chama `asaas-platform-proxy`), instruções para configurar as secrets `ASAAS_PLATFORM_API_KEY_*`.
- Atualizar `pageTitles` e `ROUTE_MODULE_MAP` (rota e slug `integracoes` continuam, só muda label).

### 4. UI da nova aba "Asaas Plataforma"

Componente `src/components/admin/integrations/AsaasPlatformTab.tsx`:
- Card com switch Sandbox/Produção (com confirmação).
- Campos: account_label, wallet_id (opcional, para split futuro).
- Aviso destacado: "Esta é a conta usada para cobrar os tenants. Não interfere nas contas Asaas dos tenants."
- Botão "Testar Conexão" → chama `asaas-platform-proxy` action `ping` (cria customer fake e captura resposta).
- Histórico: mostra `last_test_at` / `last_test_status`.
- Link para docs: https://docs.asaas.com/reference/comece-por-aqui.

### 5. Pedido de secrets

Após migração + UI prontas, vou solicitar via `add_secret`:
- `ASAAS_PLATFORM_API_KEY_SANDBOX`
- `ASAAS_PLATFORM_API_KEY_PRODUCTION`

Você pega no painel Asaas (Configurações → Integrações → Chave de API).

## Arquivos afetados

**Novos:**
- `supabase/functions/asaas-platform-proxy/index.ts`
- `src/components/admin/integrations/AsaasPlatformTab.tsx`
- `src/services/platformBillingService.ts`

**Editados:**
- `src/pages/admin/AdminConfiguracoesPage.tsx` (reorganização em Geral/Integrações + nova aba Asaas Plataforma; remoção do card antigo de Asaas global)
- `src/components/SuperAdminLayout.tsx` (renomear item "Integrações" → "Configurações")
- `supabase/config.toml` (registrar nova função sem JWT verify)

**Migração SQL:**
- Criar tabela `platform_billing_accounts` + RLS por `is_super_admin`.
- Seed de 1 linha default (`provider='asaas'`, `environment='sandbox'`).

## Garantias de não-interferência

1. Edge function nova (`asaas-platform-proxy`) — não toca a `asaas-proxy` existente.
2. Secrets novas — não substituem as antigas.
3. Tabela nova — não altera `system_settings`.
4. Tenants continuam com suas integrações próprias (CobCloud/Negociarie) intactas.
5. Caso queira no futuro permitir conta Asaas por tenant, basta adicionar `tenant_id` nullable em `platform_billing_accounts` — arquitetura já preparada.

Posso prosseguir?