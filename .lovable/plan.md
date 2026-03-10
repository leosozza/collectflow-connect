

# Plano: Switch Sandbox/Produção Asaas + Secrets para ambos ambientes

## Contexto
A integração Asaas ainda não foi implementada no código. Este plano cobre a configuração dos secrets para ambos os ambientes e um switch no Super Admin para alternar entre sandbox e produção.

## 1. Secrets necessários (4 secrets)

| Secret | Descrição |
|---|---|
| `ASAAS_API_KEY_SANDBOX` | Chave da API Asaas em sandbox |
| `ASAAS_API_KEY_PRODUCTION` | Chave da API Asaas em produção |

O ambiente ativo será armazenado na tabela `system_settings` (ou similar) no banco, controlado pelo Super Admin.

## 2. Migração SQL

Criar tabela `system_settings` (chave-valor global, acessível apenas por super_admin):

```text
system_settings
├── id (uuid PK)
├── key (text unique) — ex: "asaas_environment"
├── value (text) — "sandbox" ou "production"
├── updated_at, updated_by
```

Inserir valor padrão: `asaas_environment = 'sandbox'`.

RLS: somente super_admin pode ler/escrever.

## 3. UI Super Admin — Switch de Ambiente

Adicionar no `AdminConfiguracoesPage.tsx` (ou `AdminFinanceiroPage.tsx`) um card "Gateway de Pagamento (Asaas)" com:

- **Switch** com label "Sandbox / Produção" — salva na tabela `system_settings`
- Badge indicando ambiente atual (amarelo para sandbox, verde para produção)
- Alerta de confirmação ao mudar para produção

## 4. Edge Functions — Leitura dinâmica do ambiente

As edge functions `asaas-proxy` e `asaas-webhook` (a serem criadas) lerão o `system_settings.asaas_environment` e usarão o secret correspondente:

```text
if environment == "sandbox":
  apiKey = ASAAS_API_KEY_SANDBOX
  baseUrl = "https://sandbox.asaas.com/api/v3"
else:
  apiKey = ASAAS_API_KEY_PRODUCTION
  baseUrl = "https://api.asaas.com/v3"
```

## 5. Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar `system_settings` + seed |
| `src/services/systemSettingsService.ts` | Criar — CRUD para system_settings |
| `src/pages/admin/AdminConfiguracoesPage.tsx` | Editar — adicionar card Asaas com switch |
| `supabase/functions/asaas-proxy/index.ts` | Criar — proxy com seleção dinâmica de ambiente |
| `supabase/functions/asaas-webhook/index.ts` | Criar — webhook com seleção dinâmica |

## Ordem

1. Solicitar os 2 secrets ao usuário
2. Migração SQL (`system_settings`)
3. Service + UI do switch no Super Admin
4. Edge Functions com lógica de ambiente dinâmico

