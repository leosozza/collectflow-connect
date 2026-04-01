

# Plano: Corrigir Fluxo de Convite — Impedir Onboarding e Vincular ao Tenant

## Problema

Quando o convidado clica no link e cria a conta, o `accept-invite` é chamado durante o signup mas pode falhar silenciosamente (o usuário ainda não confirmou o email). Depois de confirmar e fazer login, o sistema não encontra `tenant_users` e redireciona para o onboarding (criar nova tenant), que é errado.

## Solução

Três correções complementares:

### 1. Persistir o invite token no localStorage (`AuthPage.tsx`)
- Após signup com invite, salvar `pendingInviteToken` no localStorage
- Após login bem-sucedido, verificar se existe token pendente e chamar `accept-invite`
- Limpar o token do localStorage após o accept-invite

### 2. ProtectedRoute: checar invite pendente antes de redirecionar ao onboarding (`ProtectedRoute.tsx`)
- Se `requireTenant && !tenant && !tenantUser`, verificar se existe `pendingInviteToken` no localStorage
- Se existir, chamar `accept-invite` e depois refetch do tenant
- Só redirecionar ao onboarding se realmente não houver convite pendente

### 3. Limpar cadastro do Vitor (migration)
- Deletar registros do Vitor da tabela `tenant_users` e `profiles` para ele poder se recadastrar corretamente
- Verificar e restaurar o invite_link para ser reutilizado

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/AuthPage.tsx` | Salvar invite token no localStorage; após login, chamar accept-invite se token pendente |
| `src/components/ProtectedRoute.tsx` | Interceptar redirecionamento ao onboarding quando há invite pendente |
| Migration SQL | Limpar dados do Vitor para recadastro |

## O que NÃO muda
- Edge functions (accept-invite funciona corretamente, o problema é quando é chamada)
- OnboardingPage — intacta
- Fluxo de criação de tenant para novos clientes — intacto
- Layout e identidade visual — intactos

