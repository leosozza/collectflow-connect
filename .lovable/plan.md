

# Diagnóstico: Prontidão para Testes com Tenants Reais

## Estado Atual do Sistema

| Recurso | Status | Detalhe |
|---|---|---|
| Tenant ativo (Temis) | 1 tenant, 6 usuários, 9.495 clientes, 2 credores, 3 acordos |
| Planos | 3 ativos (Starter R$99,90 / Professional R$299,90 / Enterprise R$799,90) |
| Onboarding | Funcional (cadastro empresa + seleção de plano) |
| Auth | Login, signup, convites, reset password |
| Asaas Gateway | Configurado em **Produção**, proxy e webhook prontos |
| Tokens | Tabelas existem, mas **Temis não tem registro em tenant_tokens** (saldo = 0) |
| Pagamentos | **0 payment_records**, **0 asaas_customers** |
| Permissões | Permission profiles + RLS configurados |

## Gaps Críticos para Testes Reais

### 1. Inicialização automática de tenant_tokens no onboarding
Quando um tenant é criado via `onboard_tenant`, nenhum registro é inserido em `tenant_tokens`. Isso faz com que consultas de saldo falhem silenciosamente. Precisa de um INSERT automático com saldo inicial (ex: 100 tokens de boas-vindas).

### 2. Webhook Asaas sem URL pública configurada
O endpoint `asaas-webhook` existe, mas o Asaas precisa de uma URL de callback cadastrada no painel deles. Sem isso, pagamentos PIX/Boleto nunca serão confirmados automaticamente.

### 3. Fluxo de primeiro pagamento do tenant
O `PaymentCheckoutDialog` cria um customer Asaas automaticamente, mas não há validação se o tenant tem CPF/CNPJ cadastrado. Sem esse dado, a criação do customer falha.

### 4. E-mail de confirmação ativo
Novos usuários precisam confirmar e-mail antes de logar. Para testes internos, pode ser necessário desabilitar temporariamente.

## Plano de Implementacao

### Fase 7A -- Preparar infraestrutura para tenant real

1. **Alterar `onboard_tenant` RPC** para criar registro em `tenant_tokens` com saldo inicial configuravel (default 50 tokens de cortesia)

2. **Adicionar campo `cnpj` na tabela `tenants`** para que o checkout Asaas funcione (criar customer com CPF/CNPJ valido)

3. **Adicionar campo CNPJ no OnboardingPage** (step 1, junto com nome e slug da empresa)

4. **Validar CNPJ no PaymentCheckoutDialog** antes de tentar criar customer Asaas -- exibir alerta se nao preenchido, com link para Central da Empresa

5. **Criar seed de tenant_tokens para tenant existente (Temis)** via migration, para nao quebrar o tenant atual

### Fase 7B -- Checklist de go-live no Super Admin

6. **Criar aba "Checklist Go-Live"** no AdminConfiguracoesPage com verificacoes automaticas:
   - Secret `ASAAS_API_KEY_PRODUCTION` configurada
   - Ambiente Asaas = production
   - Planos cadastrados e ativos
   - Webhook URL copiavel para colar no painel Asaas
   - Teste de conexao (ja existe)

### Arquivos a criar/editar

| Arquivo | Acao |
|---|---|
| Migration SQL | ADD `cnpj` to tenants, INSERT tenant_tokens for Temis, ALTER `onboard_tenant` |
| `src/pages/OnboardingPage.tsx` | Campo CNPJ no step 1 |
| `src/services/tenantService.ts` | Passar CNPJ para `onboard_tenant` |
| `src/components/financeiro/PaymentCheckoutDialog.tsx` | Validar CNPJ antes de checkout |
| `src/pages/admin/AdminConfiguracoesPage.tsx` | Aba/card Checklist Go-Live |

### Estimativa
- 1 migration + 4 arquivos editados
- Permite criar um segundo tenant real e testar o ciclo completo: signup -> onboarding -> primeiro pagamento -> consumo de tokens

