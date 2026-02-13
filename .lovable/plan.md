

# Adicionar Configuracao de Credenciais CobCloud

## Problema

A aba CobCloud na pagina de Integracoes nao possui campos para inserir as credenciais da API (Token Assessoria e Token Client). A edge function `cobcloud-proxy` espera dois secrets (`COBCLOUD_TOKEN_ASSESSORIA` e `COBCLOUD_TOKEN_CLIENT`) que nao estao configurados, impedindo qualquer operacao de importacao.

## Solucao

Adicionar um card de "Credenciais" no topo da aba CobCloud com campos para Token Assessoria e Token Client. Os valores serao salvos na tabela `tenants` no campo `settings` (JSON), e a edge function sera atualizada para ler as credenciais de la em vez de secrets fixos do ambiente.

Isso permite que cada tenant tenha suas proprias credenciais CobCloud, alinhado com a arquitetura multi-tenant.

## Alteracoes

### 1. CobCloudTab.tsx - Adicionar card de credenciais

- Adicionar dois campos de input: "Token Assessoria" e "Token Client"
- Carregar valores existentes do `tenant.settings.cobcloud_token_assessoria` e `cobcloud_token_client`
- Botao "Salvar Credenciais" que atualiza o campo `settings` do tenant
- Campos com tipo `password` para seguranca visual
- Desabilitar botoes de Testar Conexao e Importar enquanto credenciais nao estiverem salvas

### 2. cobcloud-proxy (edge function) - Ler credenciais do tenant

- Apos verificar o admin, buscar o tenant do usuario via `profiles.tenant_id`
- Ler as credenciais de `tenants.settings` (campos `cobcloud_token_assessoria` e `cobcloud_token_client`)
- Manter fallback para env vars (`COBCLOUD_TOKEN_ASSESSORIA` / `COBCLOUD_TOKEN_CLIENT`) caso existam
- Passar o `tenant_id` para as funcoes de importacao para que os clientes sejam criados com o tenant correto

### 3. Importacao com tenant_id

- Na funcao `handleImportTitulos`, incluir o `tenant_id` do usuario ao inserir novos clientes na tabela `clients`, garantindo que os registros importados pertencam ao tenant correto

## Detalhes Tecnicos

**CobCloudTab.tsx**: Usar `useTenant()` para acessar e atualizar `tenant.settings`. Chamar `updateTenant` para salvar as credenciais no campo JSON `settings`.

**cobcloud-proxy/index.ts**: Modificar `getCobCloudHeaders` para aceitar credenciais como parametro. No handler principal, apos `verifyAdmin`, buscar o perfil do usuario para obter `tenant_id`, depois buscar `tenants.settings` para extrair os tokens. Passar esses tokens para as funcoes que precisam dos headers.

**Fluxo**:
1. Admin abre aba CobCloud
2. Insere Token Assessoria e Token Client
3. Clica "Salvar Credenciais" (salva em `tenants.settings`)
4. Clica "Testar Conexao" (edge function le credenciais do tenant)
5. Clica "Importar" (importa titulos com `tenant_id` correto)

